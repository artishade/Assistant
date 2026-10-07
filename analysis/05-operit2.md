# Operit2 (artishade/Operit2) — Analysis

Snapshot analyzed: `main` @ commit `ea96a90` (2026-10-07) — `fix: 修复模型请求、跨节点同步、插件运行与 Flutter 交互等多项问题`

## 1. Identity

| Item | Value |
|---|---|
| What | Open-source cross-device Agent core: phones, desktops, and cloud boards share one "device Space"; each instance is a `CoreNode` connecting to a `Host` for local capability |
| License | **AGPL-3.0** (whole repo; upstream declared it explicitly, unlike Operit v1's LGPL) |
| Status | **Preview release** — the whitepaper (in `docs/`) warns that data formats, plugin contracts, and cross-device workflows can still change in breaking ways |
| Origin | Grown out of Operit (AAswordman) v1's Android agent practice; Operit2 is the rewrite around a shared Rust core |
| Languages | Rust core (≈343K LOC across `core/`+`hosts/`) + Flutter app (≈370K LOC Dart in `apps/flutter`) + browsers (JS/TS) |
| Platforms | Android, iOS (Apple), Windows, Linux, macOS, OpenHarmony, Web (Flutter Web + WASM), plus **ESP32** and a Linux SBC board (`PB_SBC01_H3`) |

## 2. Repository layout (top level)

```
Operit2/
├── apps/        Flutter app, CLI/TUI, ESP32 firmware, board app, (server)
│    └── flutter/app/web   Web Access frontend for web.operit.app (+ browser runtime: v86 terminal, workers)
├── core/        Rust workspace, organized first by domain then crate:
│    ├── foundation/   host-api traits, util, model, link protocol types
│    ├── persistence/  store: repositories, sync persistence, identity data
│    ├── provider/     LLM adapters (Ollama, OpenAI(+Responses), Claude, Gemini, DeepSeek, …), TTS/STT/market/memory services, local-model
│    ├── tool/         tool services: builtin executors, ToolPkg, MCP, skills, permissions, JS tool runtime
│    ├── plugin/       publishing SDK, TS type gen from Rust, JavaScript bridge (QuickJS), Compose DSL
│    ├── runtime/      application tree: ChatServiceCore, Workspace/Terminal/Browser services, STT/TTS, LocalModel…
│    ├── node/         node identity, pairing, PeerLink transports, Space routing/sync, Edge contracts (constrained devices)
│    ├── rslink/       Rust-to-link-to-Rust protocol runtime and codegen
│    ├── proxy/        generated local proxy (Rust→Dart), Edge Service projections
│    ├── application/  composition roots assembling a CoreNode
│    └── command/      CLI command layer over the runtime facade
├── hosts/       Per-platform implementations of `operit-host-api`: android, apple, ios, linux, macos, ohos, web, windows, boards/
├── plugins/     Plugin workspace: builtin/external ToolPkg sources, skills, SDK docs, TS types v1/v2
├── tools/       Per-runtime build scrtips/tools (web v86 builder, iOS ish/toybox, Android NDK fetcher), release tooling
└── docs/        Architecture docs (whitepaper PDF; Link/Access/Space; permission model; workspace file sync…)
```

## 3. Execution model: CoreNode + Space + Binding

The whitepaper of record lives in `docs/core-node-space-binding-architecture.md`:

- **User identity** (`runtime/identities/<id>`) is top-level isolation: each identity owns its device identity, pairings, spaces, chats, config, and workspaces. Identities never sync across a Space.
- **CoreNode** = one running app instance (`OperitApplication + LocalCoreProxy + HostManager`). It is the *only* executor; there is no "Chat Core"/"Agent Core" entity.
- **Space** = membership + routing + persistent data sync between nodes. Nodes are peers — a Linux box may handle more tasks because it is always online, but there is no primary/secondary.
- **Binding** = opaque per-task continuation key. Task handoff is allowed only between "tool result persisted" and "next model request not started": the new node continues from synced context and task facts; it never moves an in-flight model request, terminal process, or browser session.
- Discovery/pairing → mDNS (`_operit._tcp`) or manual; Link Access sessions ride **HTTP/WebSocket/TCP/serial** transports over a shared `PeerLink` engine.

## 4. Feature inventory (what actually exists in the tree)

**Chat & providers**
- Conversations with branches, message management, attachments, character cards and groups, prompt config.
- 30 provider adapters in `core/crates/provider/services/src/chat/llmprovider` (OpenAI, OpenAI Responses, Claude, Gemini, DeepSeek, Doubao, Kimi, Mistral, Ollama, OpenRouter, Qwen, Nvidia, Four-Router, Nous Portal, Mimo, OpenCode, ToolPkg JS providers…), plus API-key pools, connection testers, rate limiter registries, Concurrency registry.
- Local model manifests + installed registry (`LocalModelService`) and local STT/TTS (Sherpa ONNX) across platforms — even in browser (`hosts/web/src/tools/local_inference`).

**Terminal ("Managed runtime")**
- `ManagedRuntimeHost` trait boots **Node, Python, uv, pnpm** in a workspace dir; per-platform: Linux/Android/iOS/desktop child processes; **browser: a Buildroot Linux through v86** with BusyBox + Node + Python and *no* package manager (assets pinned by SHA-256, served from R2); **iOS**: app-linked iSH/toybox frameworks.
- Terminal session types: interactive PTY sessions (`startPtySession`, `readPty`, `writePty`, screen reads, hidden commands, streaming).

**Web access & browser automation (whole-project-via-web core)**
- **Web Access** = the browser reaches a running CoreNode at `web.operit.app`; the docs are explicit that opening the page does *not* make the browser an independent node and the Link Access server does not serve the Web frontend.
- `operit2 cli web open` opens the web app URL; pairing/session establishment is a separate Link flow.
- **Browser runtime** (`apps/flutter/app/web/runtime`): TS workers + WASM (`operit_runtime_worker`, `v86_runtime_worker`, model install worker), MessagePack vendored; cross-origin isolation heads required (COOP/COEP/CORP) because the runtime worker RPC uses SharedArrayBuffer.
- **Browser automation** tools aligned to the **Playwright MCP surface** built over a real Chromium speaking **CDP** (`hosts/common/chromium_browser.rs`: navigate, click by ref, snapshot, screenshots, evaluate, fill_form, drag, dialog handling, file upload interception, tabs, network/console readback).
- `StandardWebVisitTool` (`visit_web`) — host-provided page fetch/extract with UA spoofing, content hashes for caching, inline/overflow splitting (12K inline / 8K preview limits).
- Flutter in-app browser (workspace browser) with tabs, history, bookmarks, permissions; `RuntimeBrowserService` publishes semantic browser sessions + framed events to remote controllers over Link (`interact` action streams from another device).

**Terminal tools** — `execute_in_terminal_session{,_streaming}`, `execute_hidden_terminal_command`, `create/close/input/read_screen/get_terminal_info`, gate through the Tool permission tier system.

**Files & workspaces** — 24 file tools (list/read/write/delete/move/copy/zip/grep/find/apply diff/edit…), workspace templates per stack (web, node, python, go, java, typescript, office), workspace↔chat binding, workspace file sync across devices (`docs/workspace-file-sync.md`).

**Memory** — memory nodes: create/update/delete/move/link/query/link-query/USER.md preference updates; `MemoryLibrary`, `MemoryAutoSaveScheduler`, `ChatMemoryWindowPlanner`.

**System/device tools** — apps (install/uninstall/start/list), notifications, device info, usage time, location, screenshots, Bluetooth classic + BLE (scan/connect/send/read/subscribe), music playback control, system settings get/modify, toast/send notification, CLI command exec.

**Extensions**
- **ToolPkg** — QuickJS/JS packages with `METADATA` manifests, *_enabledByDefault*, categories (Automatic, Memory, …); builtin pack set: `browser`, `system_tools`, `ai_chat`, `super_admin`, `extended_memory_tools`, `goal_mode`, `plan_mode`, message translation, workflow, thinking guidance, time, editor, daily life, 12306, crossref.
- External examples: searches (duckduckgo, google, tavily, zhipu), image generators (openai/qwen/zhipu/minimax/xai/nanobanana), downloads (douyin), sidebar actions, custom AI provider, wasm demo.
- **Skills** directory (`plugins/skills`) for importable workflows/knowledge; **MCP** tools + local MCP processes; **Rust plugin SDK** with generated TS declarations; Compose DSL for in-chat UI with Material icons.

**Node & remote control**
- `list_core_nodes`, `switch_core`, `package_proxy`, use another node's host capability from an agent chat.
- Remote controllers (paired devices, Web Access) may drive **browser sessions** and **terminal** through framed events; `SyncBlobTransferManager` + `ArchiveTransferManager` move files between nodes.
- Backup/restore/snapshot export/inspect + `operit2 cli backup …`, `identity list`, `storage paths`.

**TUI/CLI first-class** — `apps/cli` includes a **TUI** (compose renderer, transcript, selection, typewriter, i18n kv files) besides headless CLI: serve/discover/connect/pair, space join/show, snapshot/backup, web open, network control.

## 5. Where the phones differ

Operit2 models an explicitly declared capability surface per platform: a host trait that returns `Err("…not implemented…")` on unsupported platforms (e.g. `AndroidWebVisitHost` needs a WebView bridge) instead of a hidden degradation. Product surfaces (settings) show the host's real permission tier: **App sandbox → Host authorization → AI Capability Limit (ReadOnly / WorkspaceWrite / Full sandbox toggle) → User tool approval**. These layers only ever restrict; a lower layer cannot conjure an upper one's power.

## 6. What is directly reusable for this repo (Web Access feature design)

1. **"Web Access ≠ new node"**: the browser is a viewer/controller. We can mirror the shape: the *device* keeps being the executor; the web client observes via authorized Inter-device transport.
2. **Capability declarations per host** — answer "can this build do this" with typed results (`TerminalEnvironment.supported`, `getEnvironment().linuxReady` in our contract), and gate tools honestly (`platforms: ['android']` in our builtin-tool catalog).
3. **Tool-checkpointed handoff** — useful later for desktop pairing: a task resumes only between persisted tool result and next model request.
4. **Terminal session surface** (`execute_in_terminal_session_*`, PTY screen reads, hidden commands) informs the Phase 1b PTY of our TerminalService.
5. **Playwright-aligned browser automation + CDP Chromium host** exemplifies the browser-agent direction the merge blueprint already planned for Phase 2.

## 7. Risks when mining this repo further

- Preview-stage ABI/contract churn; anything imported must be pinned to the analyzed commit.
- AGPL-3.0 now — code borrowed *verbatim* must carry attribution; the blueprint's AGPL decision holds.
- Enormous surface (≈700K LOC over Rust/Dart): port per capability, as service contracts, never wholesale, per `analysis/03-merge-blueprint.md`.
