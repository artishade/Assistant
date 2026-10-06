# Operit (AAswordman/Operit) — Analysis

Snapshot analyzed: `main` @ commit `2026-09-18` — `chore(release): sync dev to main for 1.12.2`

## 1. Identity

| Item | Value |
|---|---|
| What | Open-source AI Agent platform for Android: cloud/local models connected to Android system capabilities, terminals, browsers, files, and project workspaces |
| License | **LGPL-3.0** |
| Status | v1.12.2, mature release cadence (1.0 April 2025 → 1.12 July 2026) |
| Language | Kotlin (Compose UI) + C++ native; 1,402 Kotlin files, ~484K LOC |
| Min platform | Android 8.0 (API 26), **ARM64-only** |
| Successor | Operit 2 (separate repo) — shared Rust runtime + Flutter clients; this repo is the Android edition |

## 2. Repository layout (Gradle multi-module)

```
Operit/
├── app/               # Main Android app: UI, business logic, tool system, ObjectBox models, project templates
├── avator/            # Avatar modules: dragonbones/ (skeletal anim, C++/OpenGL/JNI), fbx/ (ufbx), mmd/ (MMD + Bullet3/Saba)
├── llm/               # Local inference: llama/ (llama.cpp, GGUF), mnn/ (Alibaba MNN) — CMake/JNI
├── quickjs/           # QuickJS JNI module (C sources, Kotlin wrapper, Host Bridge) — JS/TS plugin runtime
├── showerclient/      # "Shower" virtual-display client lib (connects Shower server: touch/key injection, screenshots, video)
├── terminal/          # OperitTerminalCore (git submodule) — Ubuntu 24.04 PRoot/chroot user space, multi-session terminal
├── web-chat/          # React + Vite LAN web chat frontend (synced into app assets)
├── examples/          # ToolPkg/script examples in JS/TS: bilibili/xiaohongshu/baidu-map assistants, browser,
│                      #   code_runner, custom_ai_provider, apktool, crossref, 12306, …
├── docs/              # Dev guides: TOOLPKG_FORMAT_GUIDE.md, SCRIPT_DEV_GUIDE.md, doc-src/{architecture,feature-protocol,package-dev}
└── ci/ tools/         # CI scripts, ADB/JS debug tooling, MCP bridge, Compose DSL generator, native ripgrep
```

### Main app package structure (`com.ai.assistance.operit`)

| Package | Contents |
|---|---|
| `core/` | application, chat, config, performance, subpack, tools, workflow |
| `core/tools/` | AIToolHandler, ToolRegistration, ToolExecutionLimits, ToolProgressBus |
| `core/tools/defaultTool/` | standard/ (22 built-in tool executors), accessbility/, admin/, debugger/, root/, websession/, ToolGetter, PathValidator |
| `core/tools/system/` | Terminal, OperitTerminalManager, AndroidShellExecutor, ShizukuAuthorizer/Installer, RootAuthorizer, MediaProjection capture, AccessibilityProviderInstaller, action/, shell/, shower/ |
| `core/tools/agent/` | PhoneAgent (visual screen understanding / AutoGLM), VirtualDisplayManager, ShowerController, ShowerVideoRenderer |
| `core/tools/{mcp,skill,javascript,packTool,climode,condition,calculator}` | MCP client, Skill system, JS tool runtime, packaging |
| `core/workflow/` | WorkflowExecutor, WorkflowScheduler, WorkflowWorker (WorkManager-backed) |
| `core/avatar/` | AvatarModel/Controller/Renderer abstractions + DragonBones/FBX/MMD impls |
| `plugins/` | PluginRegistry + plugin types: toolbox/, chatmessage/, chatview/, lifecycle/, toolpkg/ (13 bridge classes), workflow/ |
| `services/` | ChatServiceCore, FloatingChatService, CloudEmbeddingService, UIDebuggerService, TermuxCommandResultService, assistant/, notification/ |
| `integrations/` | a2a (agent-to-agent), externalchat, http, intent, tasker |
| `data/` | ObjectBox + preferences: memory/ (spaces, export, search config, auto-save candidates), model/, api/, backup/, converter/, dao/, db/, mcp/, mnn/, skill/, stats/, security/, recovery/ |
| `provider/` | MemoryDocumentsProvider, etc. |
| `ui/` | Compose UI: features/{chat, memory, packages, toolbox, workflow, token, tokenstats, codex, websession, assistant, settings, about, permission, startup, update, floating…}, theme/ (LiquidGlass, WaterGlass, ThemeEditor), common/, components/, floating/, widget/ |

## 3. Feature inventory (deep)

### AI chat & models
- Attach images, audio, video, documents, workspace files to context.
- Message branching, chat-history grouping/migration, automatic summaries, context limits, parallel conversations.
- Providers: OpenAI Chat/Responses, Anthropic, Gemini, compatible endpoints, key pools, connection tests; more via ToolPkg.
- **Task-model separation**: different models for chat, memory, summarization, UI control.
- **Local inference**: MNN (built-in), GGUF via llama.cpp; Ollama / LM Studio connectors.

### Tools & automation
- 22 standard tool executors: files (standard + SAF + Linux FS), HTTP, web visit/session, shell, terminal command, calculator, chat manager, device info, FFmpeg, intent, music playback, send broadcast, software settings, system ops, UI tools, workflow tools, Bluetooth sessions, cookie privacy, memory query, browser sessions.
- Permission model per tool: **Allow automatically / Ask every time / Deny**.
- Android automation: Accessibility, **Shizuku** (ADB-level), **Root**; virtual displays (Shower) incl. root virtual displays.
- PhoneAgent/AutoGLM visual screen understanding.
- Built-in browser: tabs, history, bookmarks, downloads, user scripts; **browser agent** that inspects pages, clicks, types, scrolls, screenshots.
- OCR, image understanding, camera, FFmpeg, file transfer.

### Workspaces & terminal (the big differentiators)
- **Project workspaces**: templates (Web, Android, Flutter, Node.js, TypeScript, Python, Java, Go…), file tree, code editor with syntax highlighting, live preview, change tracking, backups, export; workspace↔chat binding so the AI reads project rules and edits code.
- File systems as workspaces: app-internal, SAF, **SFTP, SSH**.
- **Ubuntu 24.04 ARM64 user space via PRoot** (chroot on supported setups); multi-session terminal with Python, Node.js, vim, SSH, tmux, custom keys, package sources.
- Dev tooling: Logcat, SQLite viewer, Git, APKTool, HTML packaging.

### Memory, characters, chat management
- **Graph memory**: multiple memory spaces, imported/chunked documents, editable node relationships, hybrid (temporal/semantic/relational) retrieval; extraction from conversations/attachments; auto-save candidates with scoring formula (documented).
- **Character cards**: import/export/backup/share by QR; Tavern JSON/PNG formats; each character binds models, memory space, tool packages, Skills, MCP services.
- **Multi-character group chat** with mentions, separate histories, collaboration.
- Chat records: import/export/lock/branch/migrate/back up/restore.

### Extensions & workflows
- **Unified marketplace**: scripts, ToolPkg, Skills, MCP services; plus prompt/tag marketplace, Artifact management/publishing.
- **ToolPkg** (QuickJS): register toolbox UI modules, app lifecycle hooks, message-processing plugins, XML render plugins, input-menu toggles, chat input/message/runtime hooks, tool lifecycle hooks, prompt pipeline hooks (input/history/system-prompt/tool-prompt/finalize), summary hooks; `api_version`-gated; dependency resolution (`requires`); hook timeout gating (1–60s).
- **MCP**: local or remote servers (uvx, npx launch), marketplace integration.
- **Visual workflow builder**: trigger/execution/condition/logic/data-extraction nodes; triggers: manual, schedule, Tasker, intents, voice, app startup; logs, stats, cancellation, batch management.

### Voice, avatars, interface
- STT: local Chinese/English + OpenAI/Deepgram cloud. TTS: system, ONNX VITS local, custom HTTP, cloud providers.
- Continuous voice conversations, background wake-up, wake templates, auto read-aloud, music queue.
- Entry points: floating window, chat bubble, home-screen widget, Android default assistant.
- **Virtual avatars**: DragonBones, WebP, MP4, MMD, glTF/GLB, FBX.
- Deep theming: theme editor (basic/color/background/chat/input/interface tabs), LiquidGlass / WaterGlass styles, fonts, chat bubbles, backgrounds, toolbars, Markdown rendering, layouts.
- 9 languages; optional LAN Web Chat + HTTP API (bearer token, off by default); Tasker integration.

## 4. Architecture notes

- Kotlin + Jetpack Compose, ObjectBox for DB, OkHttp, kotlinx-serialization, Shizuku SDK, WorkManager.
- Heavy C++/JNI footprint: llama.cpp, MNN, QuickJS, ufbx, DragonBones, MMD/Saba/Bullet3, Shower renderer — fetched upstream via CMake.
- Tool system is registry-based (`ToolRegistration`, `AIToolHandler`) with pluggable executors at multiple permission tiers (standard/accessibility/admin/root/web-session).
- Plugin runtime is QuickJS with a typed Host Bridge (`toolpkg.d.ts` contract, bridge classes in `plugins/toolpkg/`).
- Terminal is an external Gradle module (`:terminal`, OperitTerminalCore submodule) providing the PRoot user space.
- Virtual display control plane: Shower server/client over Binder, with ShellRunner injection.
- 9 release notes document an aggressive feature velocity; architecture docs exist but are thinner and partially internal-language (Chinese) — contrast with Cherry's exhaustive English docs.

## 5. Strengths for a merge

1. **Device-level capability**: terminal/Ubuntu, Shizuku/Root/Accessibility automation, virtual displays, browser agent — exactly what Cherry lacks.
2. **Extension ecosystem**: ToolPkg + Skill + MCP + marketplace + visual workflows — a full platform story.
3. **Local AI**: MNN + GGUF (llama.cpp) inference, Ollama/LM Studio.
4. **Memory & characters**: graph memory with hybrid retrieval; Tavern-compatible character cards; group chat.
5. **Voice + avatars + floating window** — complete mobile-assistant surface.

## 6. Weaknesses for a merge

- UI/UX is feature-dense and utilitarian compared to Cherry's minimal design system; theming is deep but visually noisy.
- 484K LOC of tightly-coupled Kotlin in one main module; extraction cost is high.
- LGPL-3.0 + GPL-ish native components (check per-component upstream licenses during porting).
- ARM64-only, Android-only; iOS never targeted.
- AGENTS.md warns: no fallback/degradation code style, docs partially Chinese, strict no-regression engineering culture.
