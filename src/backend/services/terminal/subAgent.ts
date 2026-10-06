/**
 * Terminal sub-agent: a bounded, step-observable tool loop that drives the
 * device shell on the user's behalf (the Agentbox pattern, ported to the
 * Optimuse backend).
 *
 * The loop is deliberately independent of any chat session: a screen (or any
 * future caller) supplies a `SubAgentModelPort` that performs exactly one
 * model turn with tool definitions and returns either a reply or tool calls;
 * this module owns tool schemas, step budgeting, tool execution against
 * `terminalService`, and the per-turn message history window.
 *
 * Rules inherited from the pattern:
 * - Every shell-shaped tool lands in a shell the user can review.
 * - A failing tool returns `{ error, code }` — it never throws the run down.
 * - The budget is honest: exhausting it reports exhaustion, not success.
 */

import { terminalService, TerminalUnavailableError } from './TerminalService';

export type SubAgentToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type SubAgentMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: readonly SubAgentToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type SubAgentToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type SubAgentModelRequest = {
  messages: readonly SubAgentMessage[];
  tools: readonly SubAgentToolDefinition[];
  signal?: AbortSignal;
};

export type SubAgentModelResponse = {
  text?: string;
  toolCalls?: readonly SubAgentToolCall[];
};

/** One model turn with tools. Implemented by the caller against AiService. */
export type SubAgentModelPort = (request: SubAgentModelRequest) => Promise<SubAgentModelResponse>;

export type SubAgentHistoryTurn = { role: 'user' | 'assistant'; content: string };

export type SubAgentStep = {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type SubAgentTurnResult = {
  reply: string;
  steps: readonly SubAgentStep[];
  budgetExhausted: boolean;
};

export type SubAgentTurnInput = {
  message: string;
  model: SubAgentModelPort;
  history?: readonly SubAgentHistoryTurn[];
  maxSteps?: number;
  signal?: AbortSignal;
};

export const TERMINAL_SUB_AGENT_MAX_STEPS = 12;
const MAX_TOOL_OUTPUT_CHARS = 8_000;
const REPLY_HISTORY_TURNS = 12;

export const TERMINAL_SUB_AGENT_SYSTEM_PROMPT = `You are the Optimuse terminal sub-agent. You work inside a real shell on the user's device. Every tool call you make executes against a shell session the user can review, so:
- prefer one command at a time, and read the output before deciding what is next;
- state assumptions instead of guessing at paths you have not looked at;
- if a command fails, diagnose it from its real output rather than retrying blindly.

You have the toolbox of a shell: inspect, edit, build, test. Use read_file and write_file for workspace files, list_sessions to inspect open shells, and finish(summary) when the task is done. Do not claim something works until the output says so.`;

const TERMINAL_SUB_AGENT_TOOLS: readonly SubAgentToolDefinition[] = [
  {
    name: 'run_command',
    description: 'Run a shell command on the device and return its output and exit code.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command line to run.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path, or one relative to the workspace.' },
        max_bytes: {
          type: 'integer',
          description: 'Truncate after this many bytes (default 20000).',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a text file in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path, or one relative to the workspace.' },
        content: { type: 'string', description: 'The full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_sessions',
    description: 'List the terminal sessions currently open, with their labels and directories.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'finish',
    description: 'Declare the task complete; the summary is the final answer.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'What was done, in the user’s language.' },
      },
      required: ['summary'],
    },
  },
];

/** Single-quote a path for the POSIX shell without expanding anything. */
function shellQuote(value: string): string {
  return `'${value.split("'").join("'\\''")}'`;
}

function pickDelimiter(content: string): string {
  let delimiter = '__OPTIMUSE_EOF__';
  while (content.includes(`\n${delimiter}`)) delimiter += '_';
  return delimiter;
}

function boundToolOutput(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_TOOL_OUTPUT_CHARS ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}…` : text;
}

function fail(message: string, code: string): { error: string; code: string } {
  return { error: message, code };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<unknown> {
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    switch (name) {
      case 'run_command': {
        const command = String(args.command ?? '');
        if (!command.trim()) return fail('command is required', 'bad_request');
        const result = await terminalService.runCommand({ command });
        // Exit code and output are the value: the model diagnoses from them.
        return {
          exit_code: result.exitCode,
          output: result.output,
          truncated: result.truncated,
        };
      }
      case 'read_file': {
        const path = String(args.path ?? '');
        if (!path) return fail('path is required', 'bad_request');
        const maxBytes = Math.min(Number(args.max_bytes ?? 20_000) || 20_000, 200_000);
        const result = await terminalService.runCommand({
          command: `cat -- ${shellQuote(path)}`,
        });
        if (result.exitCode !== 0) {
          return fail(result.output.trim() || `cannot read ${path}`, 'read_failed');
        }
        const output = result.output.slice(0, maxBytes);
        return { path, content: output, truncated: result.output.length > maxBytes };
      }
      case 'write_file': {
        const path = String(args.path ?? '');
        if (!path) return fail('path is required', 'bad_request');
        const content = String(args.content ?? '');
        const delimiter = pickDelimiter(content);
        const result = await terminalService.runCommand({
          command: `cat > ${shellQuote(path)} <<'${delimiter}'\n${content}\n${delimiter}`,
        });
        if (result.exitCode !== 0) {
          return fail(result.output.trim() || `cannot write ${path}`, 'write_failed');
        }
        return { path, bytes: content.length };
      }
      case 'list_sessions': {
        const sessions = await terminalService.listSessions();
        return {
          sessions: sessions.map(({ id, label, cwd, alive }) => ({ id, label, cwd, alive })),
        };
      }
      case 'finish':
        return { done: true };
      default:
        return fail(`unknown tool: ${name}`, 'unknown_tool');
    }
  } catch (error) {
    if (error instanceof TerminalUnavailableError) {
      return fail(error.code, error.code);
    }
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return fail(error instanceof Error ? error.message : String(error), 'tool_failed');
  }
}

/**
 * Run one sub-agent turn: model → tool calls → tools → model, bounded by
 * `maxSteps`. `finish` ends the loop early; running out of budget reports
 * `budgetExhausted` instead of pretending completion.
 */
export async function runTerminalSubAgentTurn(
  input: SubAgentTurnInput,
): Promise<SubAgentTurnResult> {
  const { message, model, signal } = input;
  const maxSteps = input.maxSteps ?? TERMINAL_SUB_AGENT_MAX_STEPS;
  const history = (input.history ?? []).slice(-REPLY_HISTORY_TURNS);

  const messages: SubAgentMessage[] = [
    { role: 'system', content: TERMINAL_SUB_AGENT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: message },
  ];
  const steps: SubAgentStep[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await model({
      messages,
      tools: TERMINAL_SUB_AGENT_TOOLS,
      signal,
    });
    const toolCalls = response.toolCalls ?? [];

    if (toolCalls.length === 0) {
      return {
        reply: (response.text ?? '').trim(),
        steps,
        budgetExhausted: false,
      };
    }

    messages.push({
      role: 'assistant',
      content: response.text ?? '',
      toolCalls,
    });

    for (const call of toolCalls) {
      const result = await executeTool(call.name, call.args, signal);
      steps.push({ tool: call.name, args: call.args, result });
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        content: boundToolOutput(result),
      });
      if (call.name === 'finish') {
        const summary = String((call.args.summary as string | undefined) ?? '').trim();
        return { reply: summary || 'Done.', steps, budgetExhausted: false };
      }
    }
  }

  return {
    reply: `The terminal sub-agent hit its ${maxSteps}-step budget without finishing. Ask for something smaller or raise the budget.`,
    steps,
    budgetExhausted: true,
  };
}
