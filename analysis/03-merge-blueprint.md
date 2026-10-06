# Merge Blueprint — Cherry Studio Mobile × Operit

## 1. Decision: merge base

**Recommendation: Cherry Studio Mobile (Expo + React Native) is the base shell; Operit capabilities are ported into it as native modules + TypeScript services.**

Rationale:

| Factor | Cherry base | Operit base |
|---|---|---|
| Code quality / maintainability | Enforced seams, ESLint layer rules, token CI, docs | 484K LOC single module, high coupling |
| UI/UX | Minimal, tokenized, light/dark parity (your stated favorite) | Feature-dense, utilitarian |
| Platforms | iOS + Android | Android only, ARM64 only |
| Provider runtime | Portable `ai-runtime` over Vercel AI SDK (15+ providers) | Own HTTP layer, fewer adapters |
| Agent/MCP polish | Strong (Pi host, approvals, MCP runtime) | Strong but embedded |
| Missing capabilities | Terminal, automation, extensions, memory, voice, local models | Modern minimal UI, iOS, code discipline |

Cost note: the alternative (Cherry features into Operit) means rebuilding Expo/RN-quality UI in Compose and reimplementing the provider runtime in Kotlin — strictly more work for less gain. Cherry base keeps the hard part (design + provider + agent architecture) and adds capability modules.

## 2. Feature mapping — what moves where

| Capability | Origin | Merge path |
|---|---|---|
| Chat, streaming, markdown, attachments | Cherry | Keep as-is (base) |
| Provider connections (15+ providers, key pools, connection tests) | Cherry core; Operit adds key pools + Responses mode | Extend ai-runtime provider registry with Operit's key-pool + connection-test concepts |
| Agents, tool approval, MCP servers/plugins | Cherry | Keep; accept Operit tool executors as MCP-like tools |
| Paintings / drawings / file library / doc export / pairing | Cherry | Keep as-is |
| Terminal + Ubuntu PRoot | **Operit** | Port OperitTerminalCore as Expo native module; new Terminal feature screen + tool executor ("run_terminal_command") |
| Shell / root / Shizuku / Accessibility automation | **Operit** | Android-gated Expo modules; permission-tier service (standard/adb/root) |
| Browser + browser agent | **Operit** | Android WebView-based module + web-session tool executor; iOS: open-in-browser fallback |
| Virtual displays (Shower) | **Operit** | Optional advanced module (root/ADB), phase 3 |
| Local inference MNN / GGUF | **Operit** | Native modules behind `ai-runtime` provider interface ("local" provider type); Ollama/LM Studio via HTTP connector (works on iOS too) |
| Graph memory (spaces, hybrid retrieval) | **Operit** | Rebuild data layer on Cherry's SQLite/Drizzle + embeddings service; memory feature screen + memory tool |
| Character cards (Tavern JSON/PNG) + group chat | **Operit** | Extend Cherry Agent model with character persona + card import/export; group chat phase 3 |
| ToolPkg (QuickJS) plugins | **Operit** | Port QuickJS JNI module; hook bridges remapped to Cherry backend contracts (prompt hooks, message hooks, lifecycle) |
| Skills + unified marketplace | **Operit** | New "Marketplace" feature on top of plugin/agent/MCP packages |
| Visual workflows | **Operit** | Map to Cherry's JobRuntime for execution; new workflow editor screen; triggers via Android services / Tasker (Android-gated) |
| Voice (STT/TTS, wake, continuous) | **Operit** | Expo modules (speech APIs) + cloud STT/TTS providers; new Voice feature |
| Floating window / widget / assistant entry | **Operit** | Android-gated services (FloatingChatService port); iOS not possible |
| Avatars (DragonBones/MMD/FBX/GLB) | **Operit** | Optional/phase 3; heavy native, low priority |
| Deep theming editor | **Operit** | Not ported initially; Cherry token system stays single-source (could expose accent pickers later) |

## 3. Target architecture (Cherry-hosted)

```
packages/
  ai-runtime/            # + LocalProvider (MNN/GGUF), KeyPool, connection tests
  operit-core/ (NEW)     # TS contracts for ported capability services
src/
  backend/services/      # + terminal/, deviceAutomation/, localInference/,
                         #   memory/, voice/, marketplace/, workflowRuntime/
  backend/ai/tools/      # + tool executors: terminal, shell, accessibility, browser,
                         #   memory, workflow, local-model
  frontend/features/     # + terminal/ memory/ voice/ marketplace/ workflows/
modules/ (Expo native)   # + operit-terminal/ (PRoot), shizuku/, accessibility-bridge/,
                         #   media-projection/, browser-session/, quickjs-runtime/,
                         #   local-llm/ (llama.cpp/MNN JNI port), speech/
```

Rules preserved from Cherry:
- Only `bootstrap` wires frontend+backend; new services get narrow interfaces.
- Frontend uses `useBackendModule(key)` contracts only.
- All UI through `packages/design-tokens` + `useThemeColor`; no literals.
- New user-facing copy → all locales in the same change.

## 4. Phased plan

**Phase 0 — Foundations (1–2 wks equivalent)**
- Pin merge base: cherry-studio-app @ 2026-10-03, Operit @ 1.12.2.
- Fork/monorepo both; keep Operit history for native pieces (git subtree) to preserve LGPL attribution.
- License decision: combined app = AGPL-3.0 (Cherry) — document per-component attribution.

**Phase 1 — Terminal & workspace (highest-value port)**
- `operit-terminal` Expo module (Android): PRoot Ubuntu user space, session mgmt, PTY streaming to JS.
- Terminal feature screen (Cherry UI, xterm-like RN renderer) + `run_terminal_command` tool executor wired into Pi agent host with approval modes.
- Workspace concept: chat-bound project folders; file tree + editor screens.

**Phase 2 — Device automation & browser agent (Android-gated)**
- Shizuku/Root/Accessibility modules; permission-tier service; PhoneAgent port.
- Browser-session module + browser agent tool executors (inspect/click/type/scroll/screenshot).
- Graceful iOS story: capability detection surfaces "Android-only" states, never broken UI.

**Phase 3 — Extension platform**
- QuickJS runtime module + ToolPkg bridge remapped to Cherry contracts (prompt/message/lifecycle hooks).
- Marketplace feature (packages: ToolPkg, Skills, MCP configs) + workflow visual editor on JobRuntime.

**Phase 4 — Intelligence extras**
- Graph memory on SQLite/Drizzle + embedding service (cloud first, local later).
- Voice (STT/TTS + wake), floating window, widgets (Android-gated).
- Local inference: llama.cpp GGUF module; MNN optional.

**Phase 5 — Polish**
- Character cards + group chat; avatars (optional); theming extensions; i18n sweep; docs.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Native port effort (PRoot, llama.cpp, QuickJS JNI) is large | Port Gradle modules as-is behind Expo module facades; reuse CMake builds; only bridges are new |
| iOS/store policy: shell executors, accessibility | Android-gated capability matrix; iOS gets web chat + voice + no automation |
| License mixing (AGPL + LGPL + GPL-ish natives) | Per-component attribution file; keep Operit natives as separate linked modules |
| Feature creep → regressions in Cherry's clean architecture | Every port lands as service + contract + tool, never UI-reaching into backend |
| Upstream drift (both repos move fast) | Pin commits; rebase strategy per phase; track upstream releases quarterly |
| Team size reality: this is a multi-month platform effort | Phases deliver standalone value; Phase 1 alone = "Cherry with a terminal" |
