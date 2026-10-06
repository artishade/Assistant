/**
 * The terminal's built-in agent tools: `run_command` and `list_sessions`.
 *
 * Both land in the device shell through `terminalService`; the approval policy
 * comes from the catalog descriptor (the values below are only the floor a
 * tool declares for itself). Failures the model can act on — the native module
 * being absent, a bad input — are returned as structured `status: 'error'`
 * values rather than throws, so the model can tell the user what to do instead
 * of seeing an opaque "tool execution failed".
 */

import * as z from 'zod';

import { terminalService, TerminalUnavailableError } from '@/backend/services/terminal';

import type { RuntimeJsonValue, RuntimeTool } from '../../runtime';
import { toRuntimeInputSchema } from '../runtimeToolSchema';

export const RUN_COMMAND_TOOL_NAME = 'run_command';
export const LIST_SESSIONS_TOOL_NAME = 'list_sessions';

/** Below the sub-agent's tool window: a chat tool result is a summary, not an archive. */
const RUN_COMMAND_MAX_OUTPUT_CHARACTERS = 30_000;

export const runCommandInputSchema = z.strictObject({
  command: z.string().min(1).max(8_000).describe('The shell command line to run on this device.'),
  timeout_ms: z
    .int()
    .min(1_000)
    .max(300_000)
    .optional()
    .describe('Optional timeout in milliseconds (default 60000, max 300000).'),
});

export const listSessionsInputSchema = z.strictObject({});

type ToolOutcome = {
  value: RuntimeJsonValue;
  artifacts: [];
};

function unavailableOutcome(): ToolOutcome {
  return {
    value: {
      status: 'error',
      message:
        'The terminal is not available on this build. Use an Android dev build or production build.',
      retryable: false,
    },
    artifacts: [],
  };
}

function errorOutcome(message: string, retryable: boolean): ToolOutcome {
  return { value: { status: 'error', message, retryable }, artifacts: [] };
}

export function createRunCommandTool(): RuntimeTool {
  return {
    ref: { source: 'builtin', capabilityId: RUN_COMMAND_TOOL_NAME },
    providerName: 'terminal',
    displayName: 'Run terminal command',
    description:
      'Run a shell command on this device and return its output and exit code. ' +
      'Run one command at a time and read its output before deciding what to do next.',
    inputSchema: toRuntimeInputSchema(runCommandInputSchema),
    approval: 'ask',
    async execute({ input: rawInput, signal }) {
      const parsed = runCommandInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return errorOutcome(`Invalid input: ${z.prettifyError(parsed.error)}`, true);
      }
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      try {
        const result = await terminalService.runCommand({
          command: parsed.data.command,
          timeoutMs: parsed.data.timeout_ms,
        });
        const output =
          result.output.length > RUN_COMMAND_MAX_OUTPUT_CHARACTERS
            ? `${result.output.slice(0, RUN_COMMAND_MAX_OUTPUT_CHARACTERS)}…`
            : result.output;
        return {
          value: {
            status: 'ok',
            exit_code: result.exitCode,
            output,
            truncated: result.truncated || result.output.length > RUN_COMMAND_MAX_OUTPUT_CHARACTERS,
          },
          artifacts: [],
        } satisfies ToolOutcome;
      } catch (error) {
        if (error instanceof TerminalUnavailableError) return unavailableOutcome();
        if (error instanceof Error && error.name === 'AbortError') throw error;
        return errorOutcome(error instanceof Error ? error.message : String(error), true);
      }
    },
  };
}

export function createListSessionsTool(): RuntimeTool {
  return {
    ref: { source: 'builtin', capabilityId: LIST_SESSIONS_TOOL_NAME },
    providerName: 'terminal',
    displayName: 'List terminal sessions',
    description: 'List the terminal sessions currently open on this device.',
    inputSchema: toRuntimeInputSchema(listSessionsInputSchema),
    approval: 'auto',
    async execute() {
      try {
        const sessions = await terminalService.listSessions();
        return {
          value: {
            status: 'ok',
            sessions: sessions.map(({ id, label, cwd, alive }) => ({ id, label, cwd, alive })),
          },
          artifacts: [],
        } satisfies ToolOutcome;
      } catch (error) {
        if (error instanceof TerminalUnavailableError) return unavailableOutcome();
        if (error instanceof Error && error.name === 'AbortError') throw error;
        return errorOutcome(error instanceof Error ? error.message : String(error), true);
      }
    },
  };
}

export function createTerminalTools(): RuntimeTool[] {
  return [createRunCommandTool(), createListSessionsTool()];
}
