# devcontainers

Personal collection of Dev Container and `.gitignore` templates for common stacks
(Python, Node/Bun, Rust, Swift).

> **This README is written to be read by LLM coding assistants.**
> When bootstrapping a new project, follow the selection guide, run the exact
> copy commands, and respect the design constraints at the bottom of this file.

---

## 1. Selection guide

Pick exactly one example from `examples/` based on the target stack:

| The new project is… | Use |
| --- | --- |
| A Hono API server intended to run on Bun/Node (no frontend, no Workers) | `examples/hono-node/` |
| A Hono API server deployed to Cloudflare Workers (no frontend) | `examples/hono-workers/` |
| A Hono + Vite + React fullstack app with SSR on Node/Bun | `examples/hono-vite-react-node/` |
| A Hono + Vite + React fullstack app deployed to Cloudflare Workers | `examples/hono-vite-react-workers/` |
| A Hono + Vite + React fullstack app with Prisma + D1 (multi-Worker monorepo) | `examples/hono-vite-react-workers-prisma/` |
| A Vite Next.js app on Cloudflare Workers via [vinext](https://github.com/cloudflare/vinext) | `examples/vinext/` |
| A Python project managed with `uv` (no GPU) | `examples/python/` |
| A Python project requiring GPU / CUDA | `examples/python-cuda/` |
| A Rust project | `examples/rust/` |
| A Swift server / library on Linux | `examples/swift/` |
| A native iOS / macOS app built from an Xcode project | `examples/swift-ios-app/` |
| iOS tweak / reverse engineering with Theos, Ghidra, ipsw, jadx | `examples/swift-ios-tweak/` |

If none of the above fit, **do not invent a new example inline in the target
project**. Prefer copying the closest match and modifying it, or ask the human
whether to add a new entry under `examples/`.


`examples/swift-ios-app/` is the one template whose container **cannot build the
project**. Xcode, the Apple SDKs and the simulators do not exist on linux, so
`import SwiftUI` / `import UIKit` never resolve there and sourcekit-lsp reports
them as errors. The container covers `swift-format`, the agent tooling and any
SDK-independent code; compiling, testing and signing stay on a Mac. Its
`integration.yaml` therefore ships lint only, with the macOS build job left as a
documented per-project addition.

---

## 2. Bootstrap procedure

Given a target project directory `$TARGET`, run:

```bash
# Step 1: copy root shared configuration
cp -a .editorconfig      "$TARGET/"
cp -a .gitattributes     "$TARGET/"
cp -a .commitlintrc.yaml "$TARGET/"
cp -a .actrc             "$TARGET/"
cp -a .vscode            "$TARGET/"

# Step 2: copy the chosen example (use `.` suffix to include dotfiles)
cp -a examples/<name>/.  "$TARGET/"

# Step 3: initialize the target project's own toolchain
# (bun install / uv sync / cargo init / swift package init — depends on stack)

# Step 4 (Node / Bun examples ONLY): add the biome-plugins submodule
# The five Node examples (hono-*/vinext) reference biome-plugins in biome.json;
# the referenced .grit files must exist or `biome check` will fail in CI.
cd "$TARGET"
git init  # if not already initialized
git submodule add https://github.com/qtmleap/biome-plugins.git biome-plugins
```

Do **not** copy this repository's own `LICENSE`, `README.md`, or `.gitignore`
into the target project. Those are metadata for this template repository, not
for downstream users.

---

## 3. Root files (language-agnostic, always copied)

| File | Purpose |
| --- | --- |
| `.editorconfig` | Indent, EOL, charset. 2-space, LF, UTF-8. `ts/tsx/css/json` use single quotes. |
| `.gitattributes` | Force LF on all text files. Marks lockfiles and `*.gen.ts` as `linguist-generated`. |
| `.commitlintrc.yaml` | Conventional Commits. Enforces `type-enum` (feat/fix/docs/…) and `header-max-length: 128`. |
| `.actrc` | Config for `act` (local GitHub Actions runner). Assumes Apple Silicon (`linux/arm64`) — flip if the host is amd64. |
| `.vscode/settings.json` | Universal VS Code baseline: `formatOnSave`, `files.exclude`, `search.exclude`, file nesting patterns, JSON/YAML formatters, `terminal.integrated.defaultLocation`. Does **not** define stack-specific formatters. |
| `.vscode/tasks.json` | Runs `scripts/agents/start-agents.sh` on `folderOpen`. Guarded, so a project without that script opens cleanly. |

Root `.gitignore` and `LICENSE` and `README.md` are for maintaining this
repository itself and are not copied into downstream projects.

---

## 4. Per-example layout

Every example folder contains at minimum:

```
examples/<name>/
├── .devcontainer/
│   ├── devcontainer.json
│   ├── Dockerfile
│   ├── compose.yaml           # if using Docker Compose
│   ├── postCreateCommand.sh   # optional
│   └── postAttachCommand.sh   # optional
├── scripts/
│   └── agents/
│       ├── start-agents.sh    # tmux launcher: orchestrator + implementer + codex
│       ├── ask-agent.sh       # paste a prompt into the codex pane, read it back
│       ├── agent-session.sh   # sourced by both: the session name
│       ├── orchestrator.md    # system prompt appended to the orchestrator session
│       └── implementer.md     # system prompt appended to the implementer session
├── .gitignore                 # stack-specific ignores (node_modules, target, .venv, etc.)
├── .vscode/
│   └── settings.json          # stack-specific formatters ONLY (merge with root at copy time)
└── .github/
    └── workflows/             # stack-specific CI (test, deploy, dependency updates)
```

Stack-specific `.vscode/settings.json` in an example should contain only what
the root baseline lacks — typically `[typescript]`, `[python]`, `[rust]`, etc.
formatter defaults tied to the extensions that stack requires (Biome, Ruff,
rust-analyzer, swift-format). Do not duplicate keys that already exist in the
root `.vscode/settings.json`.

### Node / Bun examples: biome-plugins submodule

The five Node / Bun examples (`hono-node`, `hono-workers`,
`hono-vite-react-node`, `hono-vite-react-workers`, `vinext`) reference
[qtmleap/biome-plugins](https://github.com/qtmleap/biome-plugins) in their
`biome.json` under the `plugins` field. These are GritQL rules that enforce a
Zod-first TypeScript style (ban `let`, ban `??` fallbacks, ban `as`, prefer
`z.parseSafe`, etc.).

The plugins live at `./biome-plugins/*.grit` relative to the project root —
i.e. they must be added as a git submodule in the target project **after
copying**:

```bash
cd "$TARGET"
git submodule add https://github.com/qtmleap/biome-plugins.git biome-plugins
```

The integration workflow's `check` job already uses `submodules: recursive`
when checking out, so CI resolves the plugin files automatically.

To pull new rules published upstream in `qtmleap/biome-plugins`, run:

```bash
git submodule update --remote biome-plugins
git add biome-plugins
git commit -m "chore: bump biome-plugins"
```

The submodule points to the latest commit on the referenced branch of the
plugins repository at bump time, so the update is auditable via the pointer
commit in git history.

If a project prefers not to enforce these rules, drop the `plugins` array in
`biome.json` and skip the submodule step.

---

## 5. Coding agents (Claude Code + Codex)

Every example ships both agents and a tmux launcher that runs two Claude Code
sessions and one Codex session side by side. Opening the folder drops you
straight into that session:

```
┌──────────────┬──────────────┐
│              │ implementer  │
│ orchestrator ├──────────────┤
│              │ codex        │
└──────────────┴──────────────┘
  --name orchestrator   --name implementer
  talks to you,         implements what it
  splits the work,      is told
  verifies the result
                        codex
                        reviews the design,
                        second opinions
```

You talk to the **orchestrator**. It gets `orchestrator.md` appended to its
system prompt, which tells it to delegate implementation to `implementer`,
review the result with Codex, and verify everything itself.

- The two Claude Code sessions talk through Claude Code's own cross-session
  messaging (`ListAgents` / `SendMessage`, addressed by the `--name` given at
  launch) — never through tmux. They are separate sessions rather than
  subagents so that both agents' work stays visible on screen.
- Codex has no cross-session messaging, so it gets a pane of its own and the
  orchestrator pastes into it with `ask-agent.sh`. Codex sends no completion
  signal, so `ask-agent.sh -w SEC` waits and then prints the pane; `--read`
  re-reads it later.

The container cannot reach anything outside the workspace, so every pane runs
with its approval checks disabled by default — `--dangerously-skip-permissions`
for the Claude sessions, `--dangerously-bypass-approvals-and-sandbox` for Codex.
Override `CLAUDE_ARGS` / `CODEX_ARGS` if you run the launcher on a host.

### What each example provides

| Piece | Where | Purpose |
| --- | --- | --- |
| Claude Code | `features` → `stu-bell/devcontainer-features/claude-code` | Installs `claude`. |
| Codex CLI | `features` → `thamaji/devcontainer-features/codex-cli` | Downloads the statically linked musl binary from `openai/codex` releases. Pin with the `VERSION` option. Runs in the bottom right pane. |
| tmux | `features` → `jsburckhardt/devcontainer-features/tmux` | Builds tmux from the GitHub release tarball. Pin with the `version` option. |
| `start-agents.sh` | `scripts/agents/` | Creates (or attaches to) the three-pane tmux session. Each pane carries a `@role` tmux option. |
| `ask-agent.sh` | `scripts/agents/` | Pastes a prompt into a pane by `@role` and reads the answer back. Used for `codex`. |
| `agent-session.sh` | `scripts/agents/` | Sourced by both scripts so they always derive the same session name. |
| `orchestrator.md` / `implementer.md` | `scripts/agents/` | Appended to each Claude session's system prompt via `--append-system-prompt`. Edit them to change how work is split and reported. |

### Credentials

Both agents authenticate from the host's config, bind-mounted read-write so a
login inside the container persists on the host:

```
${localEnv:HOME}/.claude  →  /home/vscode/.claude   (CLAUDE_CONFIG_DIR)
${localEnv:HOME}/.codex   →  /home/vscode/.codex    (CODEX_HOME)
```

The codex feature was chosen partly because it declares no mounts or lifecycle
hooks of its own, so the `~/.codex` mount above stays under `devcontainer.json`'s
control. Some other codex features bind-mount `~/.codex` themselves and replace
`~/.codex` with a symlink on create, which conflicts with this mount.

`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` and `OPENAI_API_KEY` are forwarded
through `remoteEnv` for setups that use API keys instead of an interactive login.

### Auto-start

`postAttachCommand.sh` builds the session detached, so all three panes are
already running before anything attaches. `.vscode/tasks.json` then opens the
session on `folderOpen`:

```jsonc
"runOptions": { "runOn": "folderOpen" }
```

It lands in the editor area rather than the panel, because the root
`.vscode/settings.json` sets `"terminal.integrated.defaultLocation": "editor"`.
VS Code has no per-task property for this
([microsoft/vscode#212070](https://github.com/microsoft/vscode/issues/212070)),
so it is a workspace-wide setting and every terminal in the workspace follows
it. Move a single one back with **Terminal: Move Terminal into Panel**.

**VS Code blocks automatic tasks until you allow them, once per folder:**
Command Palette → **Tasks: Manage Automatic Tasks** → **Allow Automatic Tasks
in Folder**, then reload the window. To skip that click in every repository,
put this in your own user `settings.json`:

```jsonc
"task.allowAutomaticTasks": "on"
```

It cannot go in `.vscode/settings.json` or in `devcontainer.json` — the setting
is application-scoped, so VS Code only reads it from user settings. Note that
turning it on lets *any* folder you open run its `folderOpen` task.

If `tmux` or `claude` is missing, the script warns and falls back to a plain
login shell — a broken agent setup must never make the terminal unusable. A
missing `codex` only costs the third pane.

### Escape hatches

| Variable | Effect |
| --- | --- |
| `AGENTS_TMUX=0` | Skip tmux entirely; use a plain shell. |
| `AGENTS_SESSION` | tmux session name. `devcontainer.json` sets it to `${localWorkspaceFolderBasename}`; without it the name comes from the workspace directory. Non-alphanumeric characters collapse to `-`, because tmux parses `.` and `:` in target names. |
| `CLAUDE_ARGS` | Arguments for both Claude panes (default `--dangerously-skip-permissions`; set to empty to disable). |
| `CODEX_ARGS` | Arguments for the codex pane (default `--dangerously-bypass-approvals-and-sandbox`; set to empty to disable). |
| `ORCHESTRATOR_ARGS` / `IMPLEMENTER_ARGS` | Extra arguments for that pane only. |
| `ORCHESTRATOR_MODEL` / `IMPLEMENTER_MODEL` / `CODEX_MODEL` | `--model` for that pane (default: whatever the CLI picks). |

Talking to a pane by hand:

```bash
./scripts/agents/ask-agent.sh codex "What breaks in this design?" -w 120
./scripts/agents/ask-agent.sh codex -f /tmp/review.md -w 180
./scripts/agents/ask-agent.sh codex --read
```

> The permissive default exists because these containers are the sandbox. If
> you copy `start-agents.sh` somewhere that is not isolated, set `CLAUDE_ARGS`
> and `CODEX_ARGS` explicitly before relying on it.

---

## 6. Design constraints

Rules for any agent modifying this repository:

1. **Examples must remain independently copyable.** Do not introduce shared
   base configuration under `examples/_shared/`, `examples/_base/`, symlinks,
   or generation scripts. Each example directory must be a complete,
   copy-pasteable unit.

2. **Root = language-agnostic. Per-example = runtime-dependent.** If a config
   file's contents would be byte-identical across every conceivable example,
   it belongs at the repository root. Otherwise it belongs inside the
   relevant example folder.

3. **`.github/workflows/` is always per-example.** GitHub Actions workflows
   depend on the runtime (Bun, uv, cargo, swift) to execute. Even the
   "universal" commitlint job requires a runtime to run. Do not extract
   workflows to the repository root.

4. **Formatters are per-example.** Biome, Ruff, rust-analyzer, and
   swift-format each require their VS Code extension and toolchain, which is
   stack-scoped. The root `.vscode/settings.json` defines only JSON/YAML
   formatters and general editor behavior.

5. **`.editorconfig`, `.gitattributes`, `.commitlintrc.yaml`, `.actrc` are
   root-only.** Do not duplicate these files inside example folders under any
   circumstance.

6. **`_shared/`, `common/`, `base/` directories are prohibited under
   `examples/`.** The one exception is a possible future `_template/`
   directory as a *starting point for creating new examples* — this is a
   snapshot, not a runtime dependency.

7. **`.claude/`, `.mcp.json` and similar agent-side config are optional and
   per-example.** Do not add them to every example by default.

8. **`start-agents.sh`, `ask-agent.sh`, `agent-session.sh`, `orchestrator.md`
   and `implementer.md` live in `scripts/agents/` and are duplicated into every
   example on purpose.** They are byte-identical across all of them, which would
   normally argue for the root per constraint 2 — but they must travel with the
   example when it is copied into a target project. Constraint 1 wins. Edit them
   in one example, then propagate to the rest.

   They sit under `scripts/` rather than `.devcontainer/` because they are not
   container build or lifecycle configuration: they are commands a human or an
   agent runs from the workspace, like everything else in `scripts/`. Nothing
   loads them at image build time — `postAttachCommand.sh` and
   `.vscode/tasks.json` invoke them by path after the container is up, and the
   bootstrap copies the whole example directory, so the move costs nothing.

   `.vscode/tasks.json` is the opposite case and lives at the root: it is what
   *starts* the launcher, it is stack-agnostic, and it is guarded so that a
   project without `scripts/agents/start-agents.sh` still opens cleanly.

---

## 7. What NOT to do

- Do **not** run `bun install`, `uv sync`, `cargo build`, etc. inside this
  repository. `examples/*/` are inert templates; they do not have runnable
  code. Any lockfile committed here would be misleading.
- Do **not** add per-example `README.md` files unless they document something
  non-obvious about that example. Prefer keeping the layout self-explanatory.
- Do **not** rename example directories to be shorter. Names like
  `hono-vite-react-workers` are intentionally explicit so `ls` and grep
  disambiguate immediately.
- Do **not** consolidate `hono-node` + `hono-workers` (or the `hono-vite-*`
  variants) into a single directory with runtime flags. They are separate
  environments and share almost nothing at the Dev Container level.

---

## License

MIT — see [LICENSE](./LICENSE).
