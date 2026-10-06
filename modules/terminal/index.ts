import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type {
  TerminalEnvironmentInfo,
  TerminalExitEventData,
  TerminalNativeModule,
  TerminalOutputEventData,
  TerminalRunCommandRecord,
  TerminalSessionRecord,
} from './src/Terminal.types';

export type {
  TerminalEnvironmentInfo,
  TerminalExitEventData,
  TerminalOutputEventData,
  TerminalRunCommandRecord,
  TerminalSessionRecord,
};

const NativeModule: TerminalNativeModule | null =
  Platform.OS === 'web' ? null : requireOptionalNativeModule('Terminal');

/**
 * The native module is absent on web, in Expo Go, and on iOS builds. Callers
 * that need a capability answer ask `isTerminalSupported()`; operations on an
 * absent module fail with an explicit error rather than a silent no-op.
 */
export function isTerminalSupported(): boolean {
  return NativeModule !== null;
}

function requireModule(): TerminalNativeModule {
  if (!NativeModule) {
    throw new Error(
      'Terminal is not available on this build. Use an Android dev build or production build.',
    );
  }
  return NativeModule;
}

export function getTerminalEnvironment(): Promise<TerminalEnvironmentInfo> {
  return requireModule().getEnvironment();
}

export function listTerminalSessions(): Promise<TerminalSessionRecord[]> {
  return requireModule().listSessions();
}

export function createTerminalSession(label: string, cwd?: string): Promise<TerminalSessionRecord> {
  return requireModule().createSession(label, cwd ?? null);
}

export function runTerminalCommand(
  command: string,
  cwd?: string,
  timeoutMs = 60_000,
): Promise<TerminalRunCommandRecord> {
  return requireModule().runCommand(command, cwd ?? null, timeoutMs);
}

export function writeToTerminalSession(sessionId: string, data: string): Promise<void> {
  return requireModule().write(sessionId, data);
}

export function resizeTerminalSession(
  sessionId: string,
  columns: number,
  rows: number,
): Promise<void> {
  return requireModule().resize(sessionId, columns, rows);
}

export function closeTerminalSession(sessionId: string): Promise<void> {
  return requireModule().close(sessionId);
}

export function subscribeTerminalOutput(
  listener: (event: TerminalOutputEventData) => void,
): () => void {
  if (!NativeModule) return () => {};
  const subscription = NativeModule.addListener('onOutput', listener);
  return () => subscription.remove();
}

export function subscribeTerminalExit(
  listener: (event: TerminalExitEventData) => void,
): () => void {
  if (!NativeModule) return () => {};
  const subscription = NativeModule.addListener('onExit', listener);
  return () => subscription.remove();
}
