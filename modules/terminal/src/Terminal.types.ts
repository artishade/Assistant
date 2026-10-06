/** Native surface of the Terminal module (Android, Phase 1). */

export type TerminalEnvironmentInfo = {
  shell: string;
  /** Absolute path of the bootstrapped Linux rootfs, null until bootstrapped. */
  linuxRoot: string | null;
};

export type TerminalSessionRecord = {
  id: string;
  label: string;
  cwd: string;
  createdAt: number;
  alive: boolean;
};

export type TerminalRunCommandRecord = {
  exitCode: number;
  output: string;
  truncated: boolean;
};

export type TerminalOutputEventData = {
  sessionId: string;
  data: string;
};

export type TerminalExitEventData = {
  sessionId: string;
  exitCode: number;
};

type EventSubscription = { remove(): void };

export type TerminalNativeModule = {
  getEnvironment(): Promise<TerminalEnvironmentInfo>;
  listSessions(): Promise<TerminalSessionRecord[]>;
  createSession(label: string, cwd: string | null): Promise<TerminalSessionRecord>;
  runCommand(
    command: string,
    cwd: string | null,
    timeoutMs: number,
  ): Promise<TerminalRunCommandRecord>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, columns: number, rows: number): Promise<void>;
  close(sessionId: string): Promise<void>;
  addListener(
    eventName: 'onOutput',
    listener: (event: TerminalOutputEventData) => void,
  ): EventSubscription;
  addListener(
    eventName: 'onExit',
    listener: (event: TerminalExitEventData) => void,
  ): EventSubscription;
};
