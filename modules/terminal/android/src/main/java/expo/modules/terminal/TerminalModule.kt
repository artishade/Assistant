package expo.modules.terminal

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit

private const val SHELL = "/system/bin/sh"
private const val OUTPUT_LIMIT_BYTES = 256 * 1024
private const val DEFAULT_TIMEOUT_MS = 60_000L
private const val MAX_TIMEOUT_MS = 300_000L

private class BoundedRead(var text: String, var truncated: Boolean)

private fun readBounded(input: InputStream, limit: Int): BoundedRead {
    val buffer = ByteArray(8192)
    val out = ByteArrayOutputStream()
    var truncated = false
    try {
        while (true) {
            val n = input.read(buffer)
            if (n == -1) break
            if (out.size() + n > limit) {
                out.write(buffer, 0, (limit - out.size()).coerceAtLeast(0))
                truncated = true
                break
            }
            out.write(buffer, 0, n)
        }
    } catch (_: Exception) {
        // Stream closed by process teardown; buffered bytes remain valid.
    }
    return BoundedRead(out.toString("UTF-8"), truncated)
}

private class ShellSession(
    val id: String,
    val label: String,
    val cwd: String,
    val createdAt: Long,
    val process: Process,
) {
    @Volatile var alive: Boolean = true

    fun kill() {
        alive = false
        process.destroy()
    }
}

class TerminalModule : Module() {
    private val sessions = ConcurrentHashMap<String, ShellSession>()
    private val ioPool: ExecutorService = Executors.newCachedThreadPool { runnable ->
        Thread(runnable, "optimuse-terminal-io").apply { isDaemon = true }
    }

    private fun workDir(cwd: String?): File {
        val base = appContext.reactContext?.filesDir
            ?: throw CodedException("NO_CONTEXT", "Application context is not ready", null)
        val target = if (cwd.isNullOrBlank()) File(base, "terminal") else File(cwd)
        if (!target.exists()) target.mkdirs()
        return target
    }

    private fun linuxRoot(): File? {
        val base = appContext.reactContext?.filesDir ?: return null
        return File(base, "terminal/rootfs").takeIf { it.exists() }
    }

    override fun definition() = ModuleDefinition {
        Name("Terminal")

        Events("onOutput", "onExit")

        AsyncFunction("getEnvironment") {
            mapOf(
                "shell" to SHELL,
                "linuxRoot" to (linuxRoot()?.absolutePath),
            )
        }

        AsyncFunction("listSessions") {
            sessions.values.map { session ->
                mapOf(
                    "id" to session.id,
                    "label" to session.label,
                    "cwd" to session.cwd,
                    "createdAt" to session.createdAt,
                    "alive" to session.alive,
                )
            }
        }

        AsyncFunction("createSession") { label: String, cwd: String? ->
            val dir = workDir(cwd)
            val process = ProcessBuilder(SHELL)
                .directory(dir)
                .redirectErrorStream(true)
                .start()
            val id = UUID.randomUUID().toString()
            val session = ShellSession(
                id = id,
                label = label.ifBlank { "shell" },
                cwd = dir.absolutePath,
                createdAt = System.currentTimeMillis(),
                process = process,
            )
            sessions[id] = session

            ioPool.execute {
                val read = readBounded(process.inputStream, OUTPUT_LIMIT_BYTES)
                if (read.text.isNotEmpty()) {
                    sendEvent("onOutput", mapOf("sessionId" to id, "data" to read.text))
                }
                val exitCode = try {
                    process.waitFor()
                } catch (_: Exception) {
                    -1
                }
                session.alive = false
                sessions.remove(id)
                sendEvent("onExit", mapOf("sessionId" to id, "exitCode" to exitCode))
            }

            mapOf(
                "id" to id,
                "label" to session.label,
                "cwd" to session.cwd,
                "createdAt" to session.createdAt,
                "alive" to true,
            )
        }

        AsyncFunction("runCommand") { command: String, cwd: String?, timeoutMs: Int? ->
            val timeout = (timeoutMs?.toLong() ?: DEFAULT_TIMEOUT_MS).coerceIn(1L, MAX_TIMEOUT_MS)
            val process = ProcessBuilder(SHELL, "-c", command)
                .directory(workDir(cwd))
                .redirectErrorStream(true)
                .start()

            val reader: Future<BoundedRead> = ioPool.submit<BoundedRead> {
                readBounded(process.inputStream, OUTPUT_LIMIT_BYTES)
            }
            val finished = process.waitFor(timeout, TimeUnit.MILLISECONDS)
            if (!finished) process.destroyForcibly()
            val read = try {
                reader.get(2, TimeUnit.SECONDS)
            } catch (_: Exception) {
                BoundedRead("", true)
            }
            val exitCode = if (finished) process.exitValue() else -1
            val timedOut = !finished
            mapOf(
                "exitCode" to exitCode,
                "output" to read.text,
                "truncated" to (read.truncated || timedOut),
            )
        }

        AsyncFunction("write") { sessionId: String, data: String ->
            val session = sessions[sessionId]
                ?: throw CodedException("SESSION_NOT_FOUND", "No session $sessionId", null)
            if (!session.alive) {
                throw CodedException("SESSION_EXITED", "Session $sessionId has exited", null)
            }
            session.process.outputStream.write(data.toByteArray(Charsets.UTF_8))
            session.process.outputStream.flush()
        }

        // No PTY in Phase 1a: size is recorded so the PTY phase keeps the API.
        AsyncFunction("resize") { sessionId: String, _columns: Int, _rows: Int ->
            if (!sessions.containsKey(sessionId)) {
                throw CodedException("SESSION_NOT_FOUND", "No session $sessionId", null)
            }
        }

        AsyncFunction("close") { sessionId: String ->
            sessions.remove(sessionId)?.kill()
        }

        OnDestroy {
            sessions.values.forEach { it.kill() }
            sessions.clear()
            ioPool.shutdownNow()
        }
    }
}
