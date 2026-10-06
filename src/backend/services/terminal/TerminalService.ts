/**
 * Backend service for the on-device terminal.
 *
 * Adapts the native `Terminal` module (see `modules/terminal`) to the shared
 * contract in `@/shared/contracts/terminal`. Capability answers are honest:
 * on builds without the native module every environment read reports
 * `supported: false`, session reads return empty, and session/command
 * operations fail with `TerminalUnavailableError` so callers (agent tools,
 * screens) surface a real state instead of a silent no-op.
 *
 * Ownership: module singleton, wired by direct import like `fileContent` and
 * `devicePermissions` — no workflow contract until orchestration grows.
 */

import type {
  TerminalCreateSessionInput,
  TerminalEnvironment,
  TerminalExitEvent,
  TerminalModule,
  TerminalOutputEvent,
  TerminalRunCommandInput,
  TerminalSessionInfo,
} from '@/shared/contracts/terminal';

import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalEnvironment,
  isTerminalSupported,
  listTerminalSessions,
  resizeTerminalSession,
  runTerminalCommand,
  subscribeTerminalExit,
  subscribeTerminalOutput,
  writeToTerminalSession,
} from '../../../../modules/terminal';

export const TERMINAL_DEFAULT_TIMEOUT_MS = 60_000;
export const TERMINAL_MAX_TIMEOUT_MS = 300_000;

export class TerminalUnavailableError extends Error {
  readonly code = 'terminal_unavailable' as const;

  constructor() {
    super(
      'The terminal is not available on this build. Use an Android dev build or production build.',
    );
    this.name = 'TerminalUnavailableError';
  }
}

class TerminalService implements TerminalModule {
  isSupported(): boolean {
    return isTerminalSupported();
  }

  async getEnvironment(): Promise<TerminalEnvironment> {
    if (!isTerminalSupported()) {
      return { supported: false, shell: '/system/bin/sh', linuxReady: false };
    }
    const info = await getTerminalEnvironment();
    return {
      supported: true,
      shell: info.shell,
      linuxReady: info.linuxRoot !== null,
    };
  }

  async listSessions(): Promise<TerminalSessionInfo[]> {
    if (!isTerminalSupported()) return [];
    return listTerminalSessions();
  }

  async createSession(input: TerminalCreateSessionInput): Promise<TerminalSessionInfo> {
    if (!isTerminalSupported()) throw new TerminalUnavailableError();
    return createTerminalSession(input.label, input.cwd);
  }

  async runCommand(input: TerminalRunCommandInput): Promise<{
    exitCode: number;
    output: string;
    truncated: boolean;
  }> {
    if (!isTerminalSupported()) throw new TerminalUnavailableError();
    const timeoutMs = Math.min(
      Math.max(input.timeoutMs ?? TERMINAL_DEFAULT_TIMEOUT_MS, 1),
      TERMINAL_MAX_TIMEOUT_MS,
    );
    const record = await runTerminalCommand(input.command, input.cwd, timeoutMs);
    return { exitCode: record.exitCode, output: record.output, truncated: record.truncated };
  }

  async write(sessionId: string, data: string): Promise<void> {
    if (!isTerminalSupported()) throw new TerminalUnavailableError();
    await writeToTerminalSession(sessionId, data);
  }

  async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    if (!isTerminalSupported()) throw new TerminalUnavailableError();
    await resizeTerminalSession(sessionId, columns, rows);
  }

  async close(sessionId: string): Promise<void> {
    if (!isTerminalSupported()) throw new TerminalUnavailableError();
    await closeTerminalSession(sessionId);
  }

  subscribeOutput(listener: (event: TerminalOutputEvent) => void): () => void {
    return subscribeTerminalOutput(listener);
  }

  subscribeExit(listener: (event: TerminalExitEvent) => void): () => void {
    return subscribeTerminalExit(listener);
  }
}

export const terminalService = new TerminalService();
