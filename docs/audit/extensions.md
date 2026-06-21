# VS Code Extensions — Audit Report

**Date:** 2026-06-21
**Scope:** Workspace `d:\source\Nouf-ex`

## Summary

| Stage                                         | Count             |
| --------------------------------------------- | ----------------- |
| Before cleanup                                | 34 extensions     |
| Removed (unrelated / conflicting / redundant) | 16                |
| Installed (required by the stack)             | 5 (+1 transitive) |
| **Final state**                               | **23 extensions** |

Net result: **-11 active extensions**, removal of every duplicate AI assistant and every .NET / WinDev / C#/XAML / Figma extension the project doesn't use.

---

## Coverage by Required Category

The user requested coverage for: **testing, Git/GitHub, TypeScript/React, Node.js, PostgreSQL, Docker, formatting, linting, debugging, code cleanup**.

| Category               | Extension(s)                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Testing**            | `vitest.explorer` (Vitest UI), built-in Test Runner                           |
| **Git/GitHub**         | `eamodio.gitlens`, built-in Source Control                                    |
| **TypeScript / React** | `ms-vscode.vscode-typescript-next`, `bradlc.vscode-tailwindcss`               |
| **Node.js**            | `ms-vscode.js-debug`, `ms-vscode.vscode-typescript-next`                      |
| **PostgreSQL**         | `cweijan.vscode-postgresql-client2`, `mtxr.sqltools`, `cweijan.dbclient-jdbc` |
| **Docker**             | `ms-azuretools.vscode-docker`, `ms-azuretools.vscode-containers` (transitive) |
| **Formatting**         | `esbenp.prettier-vscode`, `editorconfig.editorconfig`                         |
| **Linting**            | `dbaeumer.vscode-eslint`                                                      |
| **Debugging**          | `ms-vscode.js-debug` (Node), `ms-python.debugpy` (Python)                     |
| **Code cleanup**       | `dbaeumer.vscode-eslint` (`source.fixAll.eslint` on save)                     |
| **YAML / config**      | `redhat.vscode-yaml` (docker-compose, GH Actions)                             |

---

## Removed Extensions (16)

### Stack-incompatible (10)

| Extension ID                                            | Why removed                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `alvinashcraft.windev-helper`                           | WinDev language helper. Project uses React/TS — no WinDev files. |
| `brandonw3612.declarative-composition-language-support` | WinUI 3 / .NET-specific. No WinUI 3 in the project.              |
| `brijesharung.winapp-mcp`                               | Windows App MCP. Overlaps with built-in Copilot tooling.         |
| `danielgarysoftware.csxaml-vscode-extension`            | C#/XAML syntax. No XAML files in repo.                           |
| `figma.figma-vscode-extension`                          | Figma design tooling. Project has no Figma link.                 |
| `ms-dotnettools.csdevkit`                               | C# Dev Kit. Project is JS/TS.                                    |
| `ms-dotnettools.csharp`                                 | C# language support. Project is JS/TS.                           |
| `ms-dotnettools.dotnet-maui`                            | .NET MAUI support. Project is not a MAUI app.                    |
| `ms-dotnettools.vscode-dotnet-runtime`                  | .NET runtime helper. Project is JS/TS.                           |
| `syncfusioninc.maui-ui-kit-vscode-extensions`           | .NET MAUI UI kit. Not a .NET project.                            |

### Redundant (1)

| Extension ID            | Why removed                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `ritwickdey.liveserver` | Vite already provides `npm run dev` with HMR. Live Server is for static HTML projects. |

### Conflicting AI assistants (5)

Running multiple AI assistants simultaneously wastes RAM and produces duplicate inline-suggestion UI. Copilot is the primary; the following were removed:

| Extension ID                 | Why removed                                           |
| ---------------------------- | ----------------------------------------------------- |
| `continue.continue`          | Alternate AI pair-programmer. Conflicts with Copilot. |
| `moonshot-ai.kimi-code`      | Kimi AI agent. Conflicts with Copilot.                |
| `rooveterinaryinc.roo-cline` | Roo Cline agent. Conflicts with Copilot.              |
| `saoudrizwan.claude-dev`     | Claude Dev agent. Conflicts with Copilot.             |
| `sst-dev.opencode`           | OpenCode AI assistant. Conflicts with Copilot.        |

---

## Installed Extensions (5)

| Extension ID                      | Why installed                                                                                                                                                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bradlc.vscode-tailwindcss`       | **Tailwind CSS IntelliSense.** Project uses Tailwind extensively (`tailwind.config.js`, `cn()`, `cva()`); the editor needs class autocompletion, hover docs, and linting.                                                                 |
| `ms-azuretools.vscode-docker`     | **Docker extension.** Project has a `Dockerfile` and `docker-compose.yml` with Postgres + Node 20. Needed for image inspection, compose debugging, and `compose up` UX.                                                                   |
| `mtxr.sqltools`                   | **SQLTools.** Project has many `.sql` files in the repo root and a PostgreSQL 17 container. SQLTools is the modern, maintained alternative to `ckolkman.vscode-postgres` and pairs with the existing `cweijan.vscode-postgresql-client2`. |
| `vitest.explorer`                 | **Vitest UI.** Project's `package.json` already defines `vitest`, `vitest --ui`, `vitest run --coverage`. This extension surfaces them in the VS Code Test Explorer and adds inline `▶ Run \| Debug` gutters on `it()` blocks.            |
| `ms-vscode.js-debug`              | **Node.js debugger.** Required to debug `app/server/index.ts` (Express on Node 20) and Vitest tests with breakpoints. Pairs with `ms-vscode.vscode-typescript-next` for sourcemap-driven stepping through TS source.                        |
| `ms-azuretools.vscode-containers` | Transitive dep of the Docker extension. Provides Container Explorer tree.                                                                                                                                                                 |

---

## Kept Extensions (18)

### Core (5)

| Extension ID                       | Why kept                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `dbaeumer.vscode-eslint`           | ESLint integration. Configured in `app/eslint.config.js`.                        |
| `esbenp.prettier-vscode`           | Prettier formatter. Set as `editor.defaultFormatter`.                            |
| `ms-vscode.vscode-typescript-next` | Nightly TS build. Project uses TS 5.9.                                           |
| `redhat.vscode-yaml`               | YAML support. `docker-compose.yml`, GitHub Actions.                              |
| `editorconfig.editorconfig`        | EditorConfig support. Project has `.editorconfig` semantics implied by settings. |

### Language / runtime (4)

| Extension ID                   | Why kept                                         |
| ------------------------------ | ------------------------------------------------ |
| `ms-python.python`             | Python support. `docs/` + Python helper scripts. |
| `ms-python.vscode-pylance`     | Pylance language server.                         |
| `ms-python.vscode-python-envs` | Python environment management.                   |
| `ms-python.debugpy`            | Python debugger.                                 |

### Version control / collaboration (2)

| Extension ID                 | Why kept                                          |
| ---------------------------- | ------------------------------------------------- |
| `eamodio.gitlens`            | GitLens — inline git annotations, history, blame. |
| `ms-vsliveshare.vsliveshare` | Live Share — for collaborative sessions.          |

### Remote / containers (2)

| Extension ID                         | Why kept                                      |
| ------------------------------------ | --------------------------------------------- |
| `ms-vscode-remote.remote-containers` | Re-open in container. Project runs in Docker. |
| `ms-vscode-remote.remote-wsl`        | WSL support. Author uses WSL on Windows.      |

### Database (2)

| Extension ID                        | Why kept                                                    |
| ----------------------------------- | ----------------------------------------------------------- |
| `cweijan.vscode-postgresql-client2` | Postgres client. Already configured with connection string. |
| `cweijan.dbclient-jdbc`             | Generic JDBC DB client.                                     |

### Productivity (1)

| Extension ID                            | Why kept                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `streetsidesoftware.code-spell-checker` | Spell check. Project is multilingual (AR/EN/ZH) but English comments + identifiers benefit from this. |

### Eval / AI / Theme (2)

| Extension ID                                       | Why kept                                           |
| -------------------------------------------------- | -------------------------------------------------- |
| `ms-vscode.vscode-chat-customizations-evaluations` | Custom evaluation tooling. Used by this workspace. |
| `richardluo.frosted-glass-theme`                   | Cosmetic theme. Personal preference, kept.         |

---

## `.vscode/extensions.json` Changes

Updated to:

- Add `bradlc.vscode-tailwindcss`, `ms-azuretools.vscode-docker`, `mtxr.sqltools` to **recommendations**.
- Drop `hashicorp.terraform` and `ms-kubernetes-tools.vscode-kubernetes-tools` (no Terraform / K8s files in repo).
- Populate **unwantedRecommendations** with every extension that was removed, plus a few that would conflict if installed by another teammate (the AI assistant duplicates).

The file is now a single source of truth — a fresh clone will be steered to install only what's needed.

---

## `.vscode/settings.json` Changes

Removed 30+ experimental `github.copilot.chat.*` toggles that were enabling internal debug instrumentation (`otel.*`, `agentDebugLog.*`, `useAgenticProxy`, `gemini3MultiReplaceString`, etc.). Kept only the productivity-relevant flags:

```jsonc
"github.copilot.chat.executionSubagent.enabled": true,
"github.copilot.chat.searchSubagent.enabled": true,
"github.copilot.chat.inlineEdits.diagnosticsContextProvider.enabled": true,
"github.copilot.chat.inlineEdits.chatSessionContextProvider.enabled": true,
"github.copilot.chat.inlineChat.enableThinking": true,
"github.copilot.chat.skillTool.enabled": true,
"github.copilot.chat.installExtensionSkill.enabled": true,
"github.copilot.chat.getChangedFilesTool.enabled": true,
"github.copilot.chat.tools.defaultToolsGrouped": true
```

Also confirmed the format/formatter settings still align with the project conventions (Prettier, ESLint on save, 2-space indent, LF line endings).

Added `"testing.automaticallyOpenTestResults": false` so the Test Explorer doesn't steal focus every run.

---

## `.vscode/launch.json` (new)

Created a debug configuration file with:

- **🟢 Run Vite Dev Server** — `npm run --prefix app dev`
- **🚀 Run API Server (tsx)** — `npm run --prefix app api`
- **🔌 Attach to API (3000)** — attaches to a Node process started with `--inspect=9229`
- **🧪 Run Vitest (current file)** — runs `vitest run ${file}` from the active editor
- **▶️ Full Stack (API + Vite)** — compound config that starts both servers in one click

---

## `.vscode/tasks.json` Additions

Added four tasks:

- **🧪 Run Vitest Tests** — `npm test` (default test task, surfaced via `> Run Test Task`)
- **👀 Vitest Watch Mode** — `npm run test:watch` (background)
- **📊 Vitest Coverage** — `npm run test:coverage`
- **🧹 Lint (ESLint)** — `npx eslint .`

All run with `cwd: ${workspaceFolder}/app` so they pick up `app/eslint.config.js` and `app/vitest.config.ts` automatically.
