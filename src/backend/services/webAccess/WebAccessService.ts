/**
 * Backend service for the Web Access feature.
 *
 * Adapts the shared `@/shared/contracts/webAccess` surface to what this build
 * actually declares, following the Operit2 Web Access model: the browser is a
 * viewer/controller — never an extra node — and every capability is answered
 * from the real service state instead of from assumption:
 *
 * - `chat`/`agents` are reachable once a desktop pairing exists (the granting
 *   transport family);
 * - `files` and `terminal` are declared by the platform (terminal needs the
 *   Android desktop build);
 * - `listening` stays false in Phase 1: the granting transport ships with the
 *   Phase 2 HTTP surface, and claiming otherwise would invite a broken
 *   browser session.
 *
 * Ownership: module singleton wired by direct import, like `digitalTerminal` —
 * no workflow contract until orchestration grows.
 */

import { desktopConnectionService } from '@/backend/data/services/DesktopConnectionService';
import { terminalService } from '@/backend/services/terminal';
import type {
  WebAccessCapability,
  WebAccessStatus,
  WebAccessModule,
} from '@/shared/contracts/webAccess';

const DEVICE_DEFAULT_NAME = 'Optimuse device';

class WebAccessService implements WebAccessModule {
  async getStatus(): Promise<WebAccessStatus> {
    const [connections, terminalEnvironment] = await Promise.all([
      desktopConnectionService.list().catch(() => undefined),
      terminalService.getEnvironment(),
    ]);

    const paired = (connections?.total ?? 0) > 0;

    // Pairing is the granting transport for the client-side surfaces: without a
    // paired computer there is nothing for a browser to resume.
    const pairingCapability = (id: 'chat' | 'agents' | 'files'): WebAccessCapability => ({
      id,
      status: paired ? 'available' : 'needs-setup',
      reason: paired ? 'none' : 'no-pairing',
    });

    const chat = pairingCapability('chat');
    const agents = pairingCapability('agents');
    const files = pairingCapability('files');

    const terminal: WebAccessCapability = terminalEnvironment.supported
      ? { id: 'terminal', status: 'available', reason: 'none' }
      : { id: 'terminal', status: 'platform-unsupported', reason: 'terminal-platform' };

    return {
      environment: {
        listening: false,
        deviceName: DEVICE_DEFAULT_NAME,
      },
      capabilities: [chat, agents, files, terminal],
    };
  }

  async getAccessLink(): Promise<string | undefined> {
    // Phase 2 adds the granting transport (HTTP/WS listener + pairing token).
    return undefined;
  }
}

export const webAccessService = new WebAccessService();
