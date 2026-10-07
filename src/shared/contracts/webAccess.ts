/**
 * Web Access capability contract.
 *
 * The contract answers "what can a browser reach from this device" honestly,
 * following the Operit2 Web Access model: the browser is a viewer/controller,
 * never an extra node, and every capability is declared instead of assumed.
 * Phase 1 reports the declared state and hands out the access entry point;
 * the in-app HTTP/WS transport that a browser actually connects through is
 * the next phase (see `analysis/06-web-access-blueprint.md`).
 */

export type WebAccessCapabilityStatus = 'available' | 'needs-setup' | 'platform-unsupported';

export type WebAccessCapabilityId = 'chat' | 'agents' | 'files' | 'terminal';

export type WebAccessCapability = {
  id: WebAccessCapabilityId;
  status: WebAccessCapabilityStatus;
  /** Machine-readable reason; the screen maps it to copy. */
  reason?: 'no-pairing' | 'terminal-platform' | 'none';
};

export type WebAccessEnvironment = {
  /**
   * Whether this build can answer a browser's connection at all. Phase 1
   * keeps this false everywhere: the granting transport ships in Phase 2,
   * and pretending otherwise would invite a broken browser session.
   */
  listening: boolean;
  /** Stable device label shown on the web client's pairing prompt. */
  deviceName: string;
};

export type WebAccessStatus = {
  environment: WebAccessEnvironment;
  capabilities: readonly WebAccessCapability[];
};

export interface WebAccessModule {
  getStatus(): Promise<WebAccessStatus>;
  /**
   * The deep link a browser session resumes from — the `web open` analog.
   * Returns `undefined` while no transport is configured (Phase 1).
   */
  getAccessLink(): Promise<string | undefined>;
}
