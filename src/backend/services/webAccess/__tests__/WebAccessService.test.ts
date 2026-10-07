/**
 * Tests for the WebAccess capability lines.
 *
 * The service must answer from real service state, never assumption:
 * pairing existence drives chat/agents/files, terminal declares platform
 * support, and `listening` stays false while the granting transport is
 * unimplemented.
 */

import { webAccessService } from '../WebAccessService';

jest.mock('@/backend/data/services/DesktopConnectionService', () => ({
  desktopConnectionService: {
    list: jest.fn(),
  },
}));

jest.mock('@/backend/services/terminal', () => ({
  terminalService: {
    getEnvironment: jest.fn(),
  },
}));

const list = jest.requireMock('@/backend/data/services/DesktopConnectionService')
  .desktopConnectionService.list as jest.Mock;
const getEnvironment = jest.requireMock('@/backend/services/terminal').terminalService
  .getEnvironment as jest.Mock;

describe('WebAccessService', () => {
  it('reports paired capabilities as available and unpaired as needs-setup', async () => {
    list.mockResolvedValue({ items: [{ id: 'c1' }], total: 1 });
    getEnvironment.mockResolvedValue({ supported: true, shell: 'sh', linuxReady: false });

    const status = await webAccessService.getStatus();

    expect(status.environment.listening).toBe(false);
    expect(status.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'chat', status: 'available' }),
        expect.objectContaining({ id: 'agents', status: 'available' }),
        expect.objectContaining({ id: 'files', status: 'available' }),
        expect.objectContaining({ id: 'terminal', status: 'available' }),
      ]),
    );
  });

  it('declares terminal platform-unsupported when the native terminal is absent', async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    getEnvironment.mockResolvedValue({ supported: false, shell: 'sh', linuxReady: false });

    const status = await webAccessService.getStatus();

    const terminal = status.capabilities.find((capability) => capability.id === 'terminal');
    expect(terminal).toMatchObject({
      status: 'platform-unsupported',
      reason: 'terminal-platform',
    });
    expect(status.capabilities.find((capability) => capability.id === 'chat')).toMatchObject({
      status: 'needs-setup',
      reason: 'no-pairing',
    });
  });

  it('treats a failed pairing read as nothing paired instead of throwing', async () => {
    list.mockRejectedValue(new Error('db closed'));
    getEnvironment.mockResolvedValue({ supported: false, shell: 'sh', linuxReady: false });

    const status = await webAccessService.getStatus();

    expect(status.capabilities.find((capability) => capability.id === 'agents')).toMatchObject({
      status: 'needs-setup',
      reason: 'no-pairing',
    });
  });

  it('returns no access link in phase 1', async () => {
    await expect(webAccessService.getAccessLink()).resolves.toBeUndefined();
  });
});
