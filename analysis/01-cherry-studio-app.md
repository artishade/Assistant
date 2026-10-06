# Cherry Studio App (CherryHQ/cherry-studio-app) — Analysis

Snapshot analyzed: `main` @ commit `2026-10-03` — `fix(ios-background): replace silent audio with finite background execution (#1169)`

## 1. Identity

| Item | Value |
|---|---|
| What | Mobile client (iOS + Android) of Cherry Studio, the desktop AI productivity studio |
| License | **AGPL-3.0** |
| Status | In active development (v0.1.2), official CherryHQ project |
| Language | TypeScript 100% — 2,846 TS/TSX files, ~328K LOC |
| Runtime | Expo + React Native (Hermes), Expo Router, dev client with custom native modules |
| Package manager | pnpm 12.2.1 workspace, Node 24 |

## 2. Repository layout

```
cherry-studio-app/
├── index.ts                  # RN entry
├── app.config.ts / eas.json  # Expo + EAS build config
├── drizzle.config.ts / migrations/  # SQLite (Drizzle ORM) migrations
├── modules/                  # Custom native modules (Kotlin/Swift via Expo modules API)
│   ├── backup-storage, crash-reporting, device-location, image-drop-target,
│   ├── local-network-access, pdf-text-extractor, remote-discovery, system-integration
├── packages/                 # pnpm workspace packages
│   ├── ai-runtime/           # Portable AI provider runtime (@cherrystudio/ai-runtime)
│   ├── design-tokens/        # Single source of color truth (vercel.css → shadcn.css → product.css → native.css)
│   ├── provider-registry/    # Provider/model registry
│   ├── ui/                   # CherryUI (Nitro Modules, shared iOS/Android native UI primitives)
│   └── universal/            # Portable types shared with desktop
├── src/
│   ├── app/                  # Thin Expo Router route files: (drawer), agents, chat-share, drawings,
│   │                         #   files, home, library, oauth, onboarding, paintings, plugins, search, settings
│   ├── bootstrap/            # preboot → composition (DI graph) → runtime (startup gate, splash, disposal)
│   ├── backend/              # In-process backend (enforced seam, NOT a server):
│   │   ├── ai/               #   Pi Agent Host, provider adapters, MCP runtime, observability
│   │   ├── core/, data/      #   SQLite/Drizzle services, cache, preferences, seeders
│   │   └── services/         #   agents, analytics, appUpdate, backgroundActivity, backgroundReply,
│   │                         #   backup, builtInMcp, desktopConnections, device, documentExport,
│   │                         #   file, http, jobs, keepAlive, models, paintings, permissions, profile,
│   │                         #   providers, remoteAgent, systemEntry, webSearch
│   ├── frontend/             # Features: agents, chat, documentExport, drawings, files, home, library,
│   │                         #   onboarding, paintings, plugin, search, settings
│   ├── shared/               # contracts (workflow-only Backend), data (ApiClient, PreferenceClient), core, utils
│   └── types/
└── docs/                     # Extensive architecture docs (references/ + guides/)
```

## 3. Architecture

**In-process frontend/backend seam** (from `docs/references/architecture-overview.md`):

- One React Native/Hermes runtime; no Electron processes, IPC, HTTP transport, or security isolation. The seam is *structural* — calls cross TypeScript interfaces, improving dependency direction and test substitution.
- **Dependency rule**: only `bootstrap` imports both frontend and backend. Frontend never imports SQLite, Drizzle, AI SDK, or concrete device/persistence implementations — ESLint enforces the directions.
- Backend flows: `ai → services → data`; `data` imports neither services nor AI. Workflows get narrow dependency interfaces, injected by `bootstrap/composition`.
- Providers: `DataApiProvider` (typed React Query hooks over `ApiClient`), `PreferenceProvider`, `BackendProvider` (workflow-only `Backend` via `useBackendModule(key)`), `AppBootstrapProvider` (startup gate).
- **Agent runtime**: "Pi" is the only local agent runtime — one app-owned `MobileAgentHost` resolves immutable per-turn `RuntimeTool` snapshots from persisted bindings + capability adapters. Tool approval modes: automatic vs ask.
- **Job runtime**: durable enqueue/dispatch/cancel/recovery ledger (used by painting generation) that outlives the initiating route.
- **Design system**: `packages/design-tokens/` is the *only* origin of color; components use token classes (`bg-card`, `text-muted-foreground`) or `useThemeColor()`. Literal colors are forbidden except 4 registered exemptions; CI (`pnpm design:check`) enforces token/literal parity across light/dark.
- Desktop pairing: imports supported provider configs/models from Cherry Studio Desktop (remote-discovery native module, desktopConnections service).

## 4. Feature inventory (from code + README)

### AI / chat
- Multi-provider chat: OpenAI(+compatible), Anthropic, Google/Vertex, Bedrock, Cerebras, Groq, HuggingFace, Mistral, Perplexity, Together, xAI, DeepSeek (DSML), Ark, Zhipu (web search) — via Vercel AI SDK adapters in `ai-runtime`.
- Streaming markdown chat; image/text attachments; per-model capability gating.
- **Agents**: durable Agent records (avatar, name, default model, instructions, tool-approval mode, agent-scoped MCP extensions), separate conversations per project, agent picker in chat header.
- **MCP (Model Context Protocol)**: runtime service + tool catalog store, MCP server management UI, built-in MCP service, agent-scoped MCP extensions.
- **Web search**: pluggable search services + provider-native web search.
- **Paintings / drawings**: image generation from prompt or visual template, generation history, image-to-image, driven by durable JobRuntime.
- **Plugins**: built-in tools catalog + MCP servers, unified "plugins" feature with detail/connection screens.
- **Files/library**: file management, document preview, PDF text extraction (native module), attachments.
- **Document export**: export conversation content as Markdown, HTML, image.
- **Remote agent**: control agents remotely; background generation + background reply on Android.
- **Device integration**: share sheet, system entry, keep-alive, notifications, crash reporting, backup.
- **Onboarding, i18n** (translated copy in every locale, enforced in CI), light/dark themes, font size, appearance settings.

### What it explicitly does NOT have (per README + code)
- No terminal / Linux shell / PRoot environment.
- No Android automation (Accessibility / Shizuku / Root).
- No built-in browser / browser agent.
- No visual workflows, no ToolPkg/Skill package ecosystems, no marketplace.
- No long-term memory system, no character cards, no multi-character group chat.
- No local model inference (MNN / GGUF / llama.cpp).
- No voice (STT/TTS), no floating window, no avatars.

## 5. Strengths for a merge

1. **Best-in-class code discipline**: enforced layering, contract-first design, tokenized design system, CI-checked i18n and docs. Any feature ported in gains this quality.
2. **Clean provider runtime**: `ai-runtime` package abstracts 15+ providers with one SDK; provider registry is portable.
3. **Agent + MCP story is polished**: durable agents, tool approval, MCP runtime, plugin UX.
4. **Native polish**: Expo modules for backup, PDF, location, system share, remote discovery; Nitro-based UI package.
5. **Minimal, elegant UI/UX** (Vercel-inspired neutral palette, green accent, single-source tokens) — the visual benchmark for the merged app.

## 6. Weaknesses for a merge

- Everything is mobile-app-shaped only (no desktop/server runtime), and iOS parity is a first-class requirement — heavy Android-only capabilities (Shizuku, PRoot) will need graceful degradation or Android-gated modules.
- v0.1.2: moving fast; APIs may churn (worth pinning the merge base commit).
- AGPL-3.0 — merged derivative must stay AGPL-3.0 (Operit is LGPL-3.0, compatible as a linked library; whole-app merge effectively lands under AGPL-3.0 for the combined work).
