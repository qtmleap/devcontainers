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
| iOS tweak / reverse engineering with Theos, Ghidra, ipsw, jadx, targeting a jailbroken device (rootless `.deb`, hooks via libsubstrate) | `examples/swift-ios-tweak/` |
| The same, but the tweak must also run on a stock, non-jailbroken device: Dobby + fishhook hooking, `LC_LOAD_DYLIB` injection into a decrypted IPA for TrollStore / Sideloadly, and a Frida agent harness | `examples/swift-ios-tweak-jailed/` |

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

Given a target project directory `$TARGET`, run all of the steps below **before
opening the workspace in VS Code.** Opening it earlier leaves the agents not
running, with no error and no warning to say so — see the note after the
commands.

```bash
# Step 1: copy root shared configuration (this includes the agent tooling)
cp -a .editorconfig      "$TARGET/"
cp -a .gitattributes     "$TARGET/"
cp -a .commitlintrc.yaml "$TARGET/"
cp -a .actrc             "$TARGET/"
cp -a .mcp.json          "$TARGET/"
cp -a .vscode            "$TARGET/"
cp -a scripts            "$TARGET/"

# Step 2: copy the chosen example (use `.` suffix to include dotfiles)
# This OVERWRITES .vscode/settings.json with the example's stack-specific one,
# discarding the root baseline that Step 1 just installed.
cp -a examples/<name>/.  "$TARGET/"

# Step 2b (by hand): merge the two .vscode/settings.json — see below.
# There is no command for this. Both files are JSONC, so jq cannot parse them.

# Step 3: initialize the target project's own toolchain
# (bun install / uv sync / cargo init / swift package init — depends on stack)

# Step 4 (Node / Bun examples ONLY): add the biome-plugins submodule
# The six Node examples (hono-*/vinext) reference biome-plugins in biome.json;
# the referenced .grit files must exist or `biome check` will fail in CI.
cd "$TARGET"
git init  # if not already initialized
git submodule add https://github.com/qtmleap/biome-plugins.git biome-plugins
```

**Why finishing first matters.** Two separate things start the agents, and each
one guards its own call with the same test — `[ -x scripts/agents/start-agents.sh ]`
— but the commands themselves differ:

```bash
# .vscode/tasks.json (folderOpen task): attaches to the session
[ -x scripts/agents/start-agents.sh ] && exec scripts/agents/start-agents.sh || true

# examples/*/.devcontainer/postAttachCommand.sh: builds it detached
[ -x scripts/agents/start-agents.sh ] && scripts/agents/start-agents.sh --no-attach || true
```

When that test fails, both simply do nothing: the agents do not start and
**nothing prints an error or a warning**. The guard exists so that a project
without the launcher still opens cleanly, which means a half-bootstrapped
project is indistinguishable from a healthy one at a glance. `-x` tests for an
executable file, so a `scripts/agents/start-agents.sh` that is present but has
lost its executable bit fails exactly the same silent way — `cp -a` preserves
the mode, but an archive round-trip or a `cp` without `-a` may not.

Copying `scripts/` afterwards does not fix it either — neither hook runs again on
its own, so reload the window (**Developer: Reload Window**) to pick it up. Never
read "no errors" as "the agents are running"; confirm the tmux panes exist.

`examples/swift-ios-tweak-jailed/` is the one example that also ships a
`scripts/` directory of its own (`build_ipa.py`, `fetch_vendors.sh`,
`pre-commit`). `cp -a` merges directories and the two sides share no filenames,
so the root `scripts/agents/` from Step 1 and that example's build assets from
Step 2 coexist whichever order the steps run in. Nothing is overwritten.

**Step 2b, in detail.** An example's `.vscode/settings.json` carries only
stack-specific keys — around ten of them, the `[typescript]` / `[python]` /
`[rust]` formatter bindings and similar — while the root baseline installed in
Step 1 carries 32. Because Step 2 replaces the file rather than merging it, 30
to 32 of those root keys are lost, depending on the example. One of them is
`terminal.integrated.defaultLocation`, which no example sets and which §5's
editor-area terminal depends on, so skipping this step degrades the setup
quietly rather than loudly.

Merge the two by hand: start from the root baseline and fold the example's keys
into it. There is deliberately no tooling for this. Both files are JSONC with
comments, which `jq` cannot parse at all, let alone merge; and adding a
JSONC-aware merge tool would cost the bootstrap the property that makes it
portable — that it is nothing but `cp`.

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
| `.mcp.json` | Gives every Claude Code seat its own Bun-based Codex MCP process and conversation thread. |
| `.vscode/settings.json` | Universal VS Code baseline: `formatOnSave`, `files.exclude`, `search.exclude`, file nesting patterns, JSON/YAML formatters, `terminal.integrated.defaultLocation`. Does **not** define stack-specific formatters. |
| `.vscode/tasks.json` | Runs `scripts/agents/start-agents.sh` on `folderOpen`. Guarded, so a project without that script opens cleanly. |
| `scripts/agents/` | Three Claude Code role prompts and the launcher, Codex MCP bridge, and local command-palette extension. Language-agnostic, so they live here rather than in every example — see §5. |

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
├── .gitignore                 # stack-specific ignores (node_modules, target, .venv, etc.)
├── .vscode/
│   └── settings.json          # stack-specific formatters ONLY (merge into the root baseline: §2 Step 2b)
└── .github/
    └── workflows/             # stack-specific CI (test, deploy, dependency updates)
```

The agent tooling is not part of an example. It lives once at the repository
root, in `scripts/agents/`, and reaches `$TARGET` in bootstrap Step 1 (see §5).
`examples/swift-ios-tweak-jailed/` is the only example carrying a `scripts/`
directory of its own, and it holds iOS build assets, not agent tooling.

Stack-specific `.vscode/settings.json` in an example should contain only what
the root baseline lacks — typically `[typescript]`, `[python]`, `[rust]`, etc.
formatter defaults tied to the extensions that stack requires (Biome, Ruff,
rust-analyzer, swift-format). Do not duplicate keys that already exist in the
root `.vscode/settings.json`.

### Node / Bun examples: biome-plugins submodule

The six Node / Bun examples (`hono-node`, `hono-workers`,
`hono-vite-react-node`, `hono-vite-react-workers`,
`hono-vite-react-workers-prisma`, `vinext`) reference
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

## 5. Coding agents (three Claude Code seats + Codex MCP)

`scripts/agents/` provides a tmux launcher for three visible Claude Code
sessions. Bootstrap Step 1 copies the launcher, role prompts, local VS Code
extension and root `.mcp.json` into each target project. The agent CLIs and Bun
arrive as devcontainer features.

```
┌──────────────┬──────────────┐
│              │ implementer  │
│ orchestrator ├──────────────┤
│              │ reviewer     │
└──────────────┴──────────────┘
```

Talk to the **orchestrator**. It is the only user-facing intake, delegates file
changes to `implementer`, and asks `reviewer` for independent design or change
review when that is useful. All three use Claude Code cross-session messaging
(`ListAgents` / `SendMessage`, addressed by their `--name`); tmux is only the
visible layout and never the messaging transport.

Every Claude Code process reads the project `.mcp.json` and starts its own small
Bun stdio server. The server exposes `codex.ask` and `codex.review`, starts
`codex exec` only for a tool call, and remembers that seat's Codex thread for
follow-up calls. The three threads are independent. There is no interactive
Codex pane, fixed wait, or screen scrape.

The launcher defaults to Sonnet 5 for orchestrator and reviewer and Opus 5 for
implementer. Override `ORCHESTRATOR_MODEL`, `IMPLEMENTER_MODEL`, or
`REVIEWER_MODEL` on the host to change that assignment; each example forwards
those optional values through `containerEnv`. `CODEX_MODEL` remains the model
passed to each MCP-launched Codex turn.

### What provides what

| Piece | Where | Purpose |
| --- | --- | --- |
| Claude Code | `features` → `stu-bell/devcontainer-features/claude-code` | Installs `claude` for all three panes. |
| Codex CLI | `features` → `thamaji/devcontainer-features/codex-cli` | Installs `codex`, called non-interactively by the MCP server. |
| Bun | `features` → `shyim/devcontainers-features/bun` | Runs the dependency-free MCP server with automatic dotenv loading disabled. |
| tmux | `features` → `jsburckhardt/devcontainer-features/tmux` | Hosts the three visible Claude Code panes. |
| `start-agents.sh` | `scripts/agents/` | Creates, attaches, or restarts the session and stores each role in `@role`. |
| `codex-mcp.mjs` / `.mcp.json` | root and `scripts/agents/` | Expose per-seat Codex `ask` and `review` tools over stdio. |
| role prompts | `scripts/agents/*.md` | Define orchestration, implementation, and read-only review responsibilities. |
| local extension | `scripts/agents/vscode/` | Adds **Agents: Start**, **Restart**, and **Attach** directly to the command palette. |

### Credentials and MCP approval

The host's `~/.claude` and `~/.codex` are bind-mounted read-write so logins made
inside a container persist. The host forwards `ANTHROPIC_BASE_URL`,
`ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY`, and `OPENAI_BASE_URL` through
`remoteEnv`. `postAttachCommand.sh` logs Codex in and writes its compatible
provider configuration when required. Set `CODEX_MODEL` on the host when the
endpoint does not serve Codex's own default model.

Claude Code asks for project MCP approval the first time it sees `.mcp.json` in
a project. Approve `codex` from an interactive Claude Code session; until then
`claude mcp list` reports it as pending.

### Auto-start and command palette

`postAttachCommand.sh` builds the session detached and installs the dependency-
free local VS Code extension. `.vscode/tasks.json` then attaches on
`folderOpen`. After the extension version changes, run **Developer: Reload
Window** once so VS Code loads the updated Start, Restart, and Attach commands.
VS Code may also require **Tasks: Manage Automatic Tasks** → **Allow Automatic
Tasks in Folder** once per project.

**Agents: Restart** uses `tmux respawn-pane -k`, preserving the session and any
attached terminal while replacing all three Claude processes. It also migrates
a session made by the old layout: the third `codex` role becomes `reviewer`, and
the old `claude code` display label becomes `implementer`.

If `tmux` or `claude` is missing, the launcher warns and falls back to a plain
login shell. A missing agent bundle is quieter because both startup hooks guard
on `[ -x scripts/agents/start-agents.sh ]`.

### Escape hatches

| Variable | Effect |
| --- | --- |
| `AGENTS_TMUX=0` | Skip tmux and use a plain shell. |
| `AGENTS_SESSION` | Override the tmux session name. The devcontainer supplies the host workspace directory name. |
| `CLAUDE_ARGS` | Arguments for all three Claude panes. Default: `--dangerously-skip-permissions`; export an empty value to disable it. |
| `ORCHESTRATOR_ARGS` / `IMPLEMENTER_ARGS` / `REVIEWER_ARGS` | Extra arguments for one Claude seat. |
| `ORCHESTRATOR_MODEL` / `IMPLEMENTER_MODEL` / `REVIEWER_MODEL` | Models for the three seats. Defaults: Sonnet 5 / Opus 5 / Sonnet 5. |
| `CODEX_MODEL` | Model for MCP-launched Codex turns. Default: whatever Codex selects. |
| `CODEX_MCP_ARGS` | Arguments shared by `codex exec`, `exec resume`, and `exec review`. Default: `--dangerously-bypass-approvals-and-sandbox`. |
| `CODEX_MCP_TIMEOUT_MS` | Maximum time for one Codex turn. Default: 600000. |
| `CODEX_MCP_MAX_CHARS` | Maximum returned answer length. Default: 20000. |

> The permissive defaults treat the devcontainer as the sandbox, but it still
> receives host credentials, writable configuration mounts, and usually the
> host Docker socket. Override `CLAUDE_ARGS` and `CODEX_MCP_ARGS` if that is
> wider access than the project should have.

---

## 6. Design constraints

Rules for any agent modifying this repository:

1. **Examples must stay copyable as-is, combined with the root shared files.**
   Do not introduce shared base configuration under `examples/_shared/`,
   `examples/_base/`, symlinks, or generation scripts. Nothing under `examples/`
   may require resolution or generation at copy time.

   This no longer amounts to a complete guarantee. The agent tooling now lives
   at the repository root (constraint 8), so copying an example directory by
   itself does not produce the files needed to auto-start the agents. A complete
   project is Step 1 **and** Step 2 together, never Step 2 alone.

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

7. **Project-specific `.claude/` configuration is optional and per-example.**
   The shared `.mcp.json` is the exception: it belongs at the root because all
   examples use the same Codex bridge, and bootstrap copies it into each target.

8. **The launcher, MCP bridge, role prompts, and command-palette extension live
   once at the repository root, in `scripts/agents/`.** They are
   language-agnostic and shared across all 13 examples, so constraint 2 places
   them at the root. Edit them in one place; there is nothing to propagate.

   The price is the retreat in constraint 1: an example directory alone no longer
   carries them, so bootstrapping needs Step 1 as well as Step 2. That trade is
   deliberate, and it is worth being precise about what was traded. "Maintain a
   single source for these files" is satisfied. "Copy a whole project with one
   command" is not satisfied today — §2 spends seven commands on Step 1 alone —
   but nothing about this layout prevents it: the copying could be collapsed
   into a single command whenever that is worth doing. "An example directory is
   self-contained" is the requirement that was actually given up, and no
   rearrangement of the bootstrap brings it back. Do not reinstate the
   per-example copies in order to win it back.

   They sit under `scripts/` rather than `.devcontainer/` because they are not
   container build or lifecycle configuration: they are commands a human or an
   agent runs from the workspace, like everything else in `scripts/`. Nothing
   loads them at image build time — `postAttachCommand.sh` and
   `.vscode/tasks.json` invoke them by path after the container is up, and Step 1
   puts them at the project root, so the path they are invoked by is unchanged.

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
