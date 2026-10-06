/**
 * Terminal capability contract.
 *
 * The contract stays platform-neutral: the backend `TerminalService` adapts the
 * native terminal module to these shapes, and agent tools, the terminal
 * sub-agent, and (in a later phase) the terminal screen all consume only this.
 *
 * Phase 1a sessions are pipe-backed shells on Android; a PTY and the Linux
 * (Ubuntu user space) bootstrap land in the same contract without changes
 * (`linuxReady` flips when the bootstrap rootfs exists).
 */

export type TerminalSessionInfo = {
  id: string;
  label: string;
  cwd: string;
  createdAt: number;
  alive: boolean;
};

export type TerminalCommandResult = {
  exitCode: number;
  /** Combined stdout + stderr, bounded by the service's output window. */
  output: string;
  truncated: boolean;
};

export type TerminalEnvironment = {
  /** False when the native module is absent (web, Expo Go, iOS builds). */
  supported: boolean;
  shell: string;
  /** True once the Linux user-space rootfs has been bootstrapped on device. */
  linuxReady: boolean;
};

export type TerminalOutputEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  exitCode: number;
};

export type TerminalCreateSessionInput = {
  label: string;
  cwd?: string;
};

export type TerminalRunCommandInput = {
  command: string;
  cwd?: string;
  /** Bounded by the service; defaults to 60s, capped at 300s. */
  timeoutMs?: number;
};

export interface TerminalModule {
  getEnvironment(): Promise<TerminalEnvironment>;
  listSessions(): Promise<TerminalSessionInfo[]>;
  createSession(input: TerminalCreateSessionInput): Promise<TerminalSessionInfo>;
  runCommand(input: TerminalRunCommandInput): Promise<TerminalCommandResult>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, columns: number, rows: number): Promise<void>;
  close(sessionId: string): Promise<void>;
  /** Returns an unsubscribe function. No-op when unsupported. */
  subscribeOutput(listener: (event: TerminalOutputEvent) => void): () => void;
  /** Returns an unsubscribe function. No-op when unsupported. */
  subscribeExit(listener: (event: TerminalExitEvent) => void): () => void;
}

/** Structured failure the model can act on instead of an opaque throw. */
export type TerminalUnavailableErrorShape = {
  code: 'terminal_unavailable';
  message: string;
};
