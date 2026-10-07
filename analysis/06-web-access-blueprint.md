# Web Access Blueprint — Operit2's "whole project via browser" on Optimuse

Read [Operit2 analysis](./05-operit2.md) first; this blueprint ports only what the merge rules
allow (`analysis/03-merge-blueprint.md`) and lands Phase 1 in code.

## 1. What the feature means here

Operit2 ships **Web Access**: a browser (`web.operit.app`) reaches a running CoreNode and can
observe and drive it — chat, terminal (v86), files, browser automation — while the phone/desktop
stays the executing node. Two architecture rules travel with the feature:

- **The browser is a viewer/controller, not a node.** Opening the page never enlarges the host
  capability set; authorization still lives on the executing device.
- **Capabilities are declared, not assumed.** A host answers "can I do this" with a typed surface;
  unsupported platforms return honest states instead of hidden degradation.

Optimuse inherits the same shape from Cherry Mobile's in-process backend: there is
**no server runtime to point a browser at today**. Phase 1 therefore ships the *product surface*
(webAccess service contract, settings status screen, i18n everywhere) with honest capability
gates, and stages the transport work that makes a browser reach a device.

## 2. Phase 1 — what lands in this change

| Layer | Files | Behavior |
|---|---|---|
| Contract | `src/shared/contracts/webAccess.ts` | `WebAccessEnvironment`, `WebAccessCapability`, `WebAccessStatus`, `WebAccessModule` |
| Backend service | `src/backend/services/webAccess/` | Reads pairing existence (`desktopConnectionService.list()`) and `terminalService.getEnvironment()`; `getAccessLink()` returns `undefined` until the Phase 2 transport exists |
| Model port | `src/frontend/data/webAccess.ts` | `webAccessQueryOptions` / `webAccessQueryKeys` with the standard cache pattern |
| Feature screen | `src/frontend/features/settings/webAccess/` + `src/app/settings/web-access.tsx` | Status rows: chat/agents/files (pairing-gated), terminal (platform-gated), device label; “Open from a browser” info row |
| Settings entry | `src/frontend/features/settings/SettingsScreen.tsx` | New **Web access** row that opens the status screen |
| i18n | all 13 locales | `webAccess.*` keys translated in the same change (repo rule) |

Behavior guarantees:

- **iOS/Android parity of information, platform-gated of *capability*.** The terminal card states
  plainly that the terminal needs an Android build instead of pretending.
- **Pairing-aware**: the chat/agents card reflects whether a desktop connection exists, because
  browser access is granted through the same transport family.
- **No silent no-ops**: unsupported actions surface reason strings, following the
  `TerminalUnavailableError` honesty pattern.

## 3. Phase 2+ (tracked, not coded here)

| Phase | Content |
|---|---|
| 2 | **HTTP surface**: a small in-app HTTP/WebSocket listener (Android/iOS dev-build parity with `local-network-access` module) exposing read-only session + terminal output streams; pairing QR with one-time token (Link Access analog), scoped grants revocable from Settings. |
| 3 | **Full web client**: React Web build re-using `packages/ui` (web target) against the same Data API; terminal rendered with xterm.js over the PTY Phase 1b of the terminal feature; browser automation tools land under `src/backend/services/browser`. |
| 4 | **Space/binding** (Operit2 concept): task handoff between this device and a paired desktop is legal only between "tool result persisted" and "next model request not started." |

## 4. Deliberate non-goals in Phase 1

- No persistent server process in the Expo client; nothing listens yet.
- No credential-free pairing; authorization work belongs with the HTTP surface.
- No cross-device runtime ownership claims (mirrors Operit2: active processes stay on their node).
