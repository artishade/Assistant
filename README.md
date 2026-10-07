# Optimuse

**One workspace for every model — chat, agents, plugins, MCP, and a real Linux terminal with an AI sub-agent that drives it.**

Optimuse is an open-source AI workspace for iOS and Android. It combines:

- **Multi-provider chat** — connect dozens of LLM providers (OpenAI, Anthropic, Gemini, Groq, Mistral, xAI, DeepSeek, OpenAI-compatible endpoints, and more), with streaming, Markdown, and attachments.
- **Agents** — durable agents with their own instructions, default models, and tools, with approval modes for tool calls.
- **Plugins & MCP** — built-in tool plugins and Model Context Protocol servers extend what agents can do.
- **Terminal (Phase 1)** — a real shell session on-device, plus an **AI terminal sub-agent**: a tool loop (`run_command`, `read_file`, `write_file`, `list_sessions`, `finish`) whose every action lands in a terminal session the user can watch, modeled after the Agentbox pattern from [Playground](https://github.com/artishade/Playground).
- **Web access (Phase 1)** — a capability surface that declares what a browser can reach from this device (chat, agents, files, terminal), following Operit2's Web Access model: a browser is a viewer/controller, never an extra node, and the device stays the executor. The in-app listener and pairing transport ship in a later phase.
- **Image creation, file library, document export, desktop pairing** — carried from the base workspace.

## Status

Phase 1 implementation kickoff: the workspace base is imported and rebranded, and the terminal
domain (contracts, backend service, sub-agent tools, feature screen) is being scaffolded. The
Web Access capability surface (contract, backend service, settings screen, translations) is in
place; the transport that a browser actually connects through is the next phase
(see [`analysis/06-web-access-blueprint.md`](analysis/06-web-access-blueprint.md)).
See [`analysis/`](analysis/) for the codebase analysis and merge blueprint that drive the roadmap.

## Provenance & license

Optimuse is derived from [Cherry Studio Mobile](https://github.com/CherryHQ/cherry-studio-app)
(Expo + React Native architecture, design system, chat/agent/plugin foundation) and takes its
terminal, extension, and automation direction from [Operit](https://github.com/AAswordman/Operit)
and [Playground](https://github.com/artishade/Playground).

- Cherry Studio Mobile is licensed under the **GNU Affero General Public License v3.0**; the
  combined work in this repository continues under AGPL-3.0 (see [`LICENSE`](LICENSE)).
- Operit and OperitTerminalCore are **LGPL-3.0**; Playground's design is referenced, and its code
  is used under its own license as attributed in the terminal module.
- Upstream names are not used as product or module names: this product is Optimuse, and its tools
  are named plainly (`terminal`, `plugins`, …).

## Development

Built with Expo and React Native. Node.js 24 and pnpm 12.2.1.

```bash
pnpm install

# Build and install the development client for one platform:
pnpm ios
# or: pnpm android

# Start Metro for an already installed development client:
pnpm dev

# Type check everything:
pnpm typecheck
```

The app includes custom native modules and requires a development client.

## Repository layout

```
analysis/    Codebase analysis of the merged sources and the merge blueprint
src/         App: routes (app), frontend features, backend services, shared contracts
packages/    Workspace packages: ai-runtime, design-tokens, ui, provider-registry, universal
modules/     Custom native modules (backup, crash reporting, PDF, terminal, …)
docs/        Architecture and development documentation
```
