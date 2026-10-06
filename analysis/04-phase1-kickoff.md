# Phase 1 Kickoff — Terminal & Sub-Agent

Scope: the `terminal` tool family (clean naming — no upstream repository names anywhere in
Optimuse), modeled on the Agentbox pattern from [Playground](https://github.com/artishade/Playground)
(PTY sessions + bounded tool loop) with the Linux environment direction taken from
Operit/OperitTerminalCore.

## What landed in this kickoff

| Layer | Files | State |
|---|---|---|
| Contract | `src/shared/contracts/terminal.ts` (+ barrel export) | Sessions, command results, environment, events |
| Backend service | `src/backend/services/terminal/TerminalService.ts` | Native-module adapter with honest `supported: false` / `TerminalUnavailableError` semantics |
| Sub-agent loop | `src/backend/services/terminal/subAgent.ts` | Agentbox-style bounded loop: 5 tools (`run_command`, `read_file`, `write_file`, `list_sessions`, `finish`), 12-step budget, 8K tool-output window, injected `SubAgentModelPort` |
| Agent tools | `src/backend/ai/agent/tools/terminal/` | `run_command` (approval floor `ask`) + `list_sessions` as `RuntimeTool`s |
| Catalog wiring | `src/shared/data/types/builtInTool.ts`, `tools/builtInToolSource.ts` | Capability IDs + descriptors (`platforms: ['android']`; `run_command` not auto-promotable) |
| Native module | `modules/terminal/` (Android) | One-shot `runCommand` (bounded 256KB, timeout-clamped 60s/300s) + long-lived `sh` sessions with `onOutput`/`onExit` events |

## Design decisions

1. **Naming**: everything is `terminal` — module dir, service, tools, capability IDs. No
   upstream project names appear in code paths, per product decision.
2. **Sub-agent = loop + injected model port.** `AiService.generateText` returns final text only
   (its internal AI-SDK tool loop is not step-observable), so the sub-agent owns its own loop and
   takes a `SubAgentModelPort` (one model turn in → reply or tool calls out). Wiring the concrete
   adapter over `AiService`/`buildAgentParamsFor` is the next backend task; it must surface
   `tools` in `AiBaseRequest` and parse `tool_calls` (see `subAgent.ts` types — no changes needed
   in the loop).
3. **Phase 1a sessions are pipe-backed `sh`, not PTY.** `vim`/`top` need a PTY; the contract
   already carries `resize` (recorded until the PTY lands). The PTY port from OperitTerminalCore
   (kotlin `Pty.kt`, ANSI emulator, canvas renderer) is Phase 1b behind the same contract.
4. **Linux environment**: `getEnvironment().linuxReady` reports whether
   `<filesDir>/terminal/rootfs` exists; the Ubuntu user-space bootstrap (download + extract +
   PRoot launcher) flips it. Contract-ready, bootstrap pending.
5. **Gate honesty**: iOS/web/Expo-Go → `supported: false`; tools return
   `status: 'error'` values (`retryable: false`) instead of throwing. Known gap: the catalog
   gates on `platforms` only — Android builds without the dev client still *offer* `run_command`
   and discover unavailability at execution. Phase 1b should plumb `terminalService.isSupported()`
   into `BuiltInToolScope` so the tool is absent rather than present-and-broken (per
   `builtInToolSource.ts`'s own resolution contract).

## Remaining checklist (in order)

1. **Model adapter**: `SubAgentModelPort` over `AiService` (needs `tools` on the request path
   and `tool_calls` parsing) — then the Terminal screen can run sub-agent turns.
2. **Terminal screen** `src/frontend/features/terminal/` + route + sidebar row:
   session tabs, output view (scrollback), input; sub-agent panel showing live `steps`.
   Follow `plugins/` route shape (`_layout.tsx` + stack).
3. **i18n**: add `terminal.*` keys to `src/frontend/i18n/locales/` — every supported locale in
   the same change (repo rule); verify with `pnpm i18n:check`.
4. **PTY (Phase 1b)**: port OperitTerminalCore essentials (Pty, ANSI emulator, renderer) behind
   `modules/terminal`; `resize` becomes real.
5. **Linux bootstrap (Phase 1b)**: Ubuntu rootfs download/extract to `<filesDir>/terminal/rootfs`,
   PRoot launch path, `linuxReady` flips true.
6. **Catalog gate**: terminal availability in `BuiltInToolScope` (see design decision 5).

## Verification status

- `pnpm typecheck:packages` passes.
- Full `pnpm typecheck:app` **cannot run on this sandbox** (2GB RAM; `tsc` OOMs at every heap
  size that fits the box). Must be run on CI or a ≥8GB machine before merge.
- `oxlint` on touched files: see commit message.
