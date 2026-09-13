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
| `.vscode/settings.json` | Universal VS Code baseline: `formatOnSave`, `files.exclude`, `search.exclude`, file nesting patterns, JSON/YAML formatters, `terminal.integrated.defaultLocation`. Does **not** define stack-specific formatters. |
| `.vscode/tasks.json` | Runs `scripts/agents/start-agents.sh` on `folderOpen`. Guarded, so a project without that script opens cleanly. |
| `scripts/agents/` | The agent tooling: five files (`start-agents.sh`, `ask-agent.sh`, `agent-session.sh`, `orchestrator.md`, `implementer.md`) that run two Claude Code sessions plus one Codex session in tmux. Language-agnostic, so it lives here rather than in every example — see §5. |

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

## 5. Coding agents (Claude Code + Codex)

`scripts/agents/` at the repository root provides a tmux launcher that runs two
Claude Code sessions and one Codex session side by side, and bootstrap Step 1
copies it into every project. The agent CLIs themselves arrive as devcontainer
features, so those stay per-example. Opening the folder drops you straight into
that session:

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

Every pane runs with its approval checks disabled by default —
`--dangerously-skip-permissions` for the Claude sessions,
`--dangerously-bypass-approvals-and-sandbox` for Codex. That default exists
because the container is treated as the sandbox, not because it is sealed off:
it is not. Common to all 13 examples: the host's `~/.claude` and `~/.codex` are
bind-mounted read-write and its `~/.ssh`, `~/.aws` and `~/.config/gh` read-only;
`OPENAI_API_KEY` and the `ANTHROPIC_*` pair come through `remoteEnv`; and
`docker-outside-of-docker` shares the host's Docker socket — that one by itself
is enough to reach the host.

Individual examples widen it further, so the blast radius is per-example rather
than uniform: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` reach the four
Workers examples, `GH_TOKEN` the two `swift-ios-tweak*` ones, and `HF_TOKEN`
plus `WANDB_API_KEY` only `python-cuda`. The two `swift-ios-tweak*` examples also
run with `network_mode: host`. So read it as "this container plus the host
credentials and daemon that this example is given", and override `CLAUDE_ARGS` /
`CODEX_ARGS` if that is wider than you want.

### What provides what

| Piece | Where | Purpose |
| --- | --- | --- |
| Claude Code | `features` → `stu-bell/devcontainer-features/claude-code` | Installs `claude`. |
| Codex CLI | `features` → `thamaji/devcontainer-features/codex-cli` | Downloads the statically linked musl binary from `openai/codex` releases. Pin with the `VERSION` option. Runs in the bottom right pane. |
| tmux | `features` → `jsburckhardt/devcontainer-features/tmux` | Builds tmux from the GitHub release tarball. Pin with the `version` option. |
| `start-agents.sh` | `scripts/agents/` (repository root, copied by Step 1) | Creates (or attaches to) the three-pane tmux session. Each pane carries a `@role` tmux option. |
| `ask-agent.sh` | `scripts/agents/` (repository root, copied by Step 1) | Pastes a prompt into a pane by `@role` and reads the answer back. Used for `codex`. |
| `agent-session.sh` | `scripts/agents/` (repository root, copied by Step 1) | Sourced by both scripts so they always derive the same session name. |
| `orchestrator.md` / `implementer.md` | `scripts/agents/` (repository root, copied by Step 1) | Appended to each Claude session's system prompt via `--append-system-prompt`. Edit them to change how work is split and reported. |

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

`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `OPENAI_API_KEY` and
`OPENAI_BASE_URL` are forwarded through `remoteEnv` for setups that use API keys
instead of an interactive login. Claude Code reads its key from the environment
directly. Codex does not, and needs three more things, all handled by
`postAttachCommand.sh`:

- **Codex reads credentials from `auth.json`, not from `OPENAI_API_KEY`**. With
  the variable alone it still stops at the interactive sign-in screen, so
  `postAttachCommand.sh` runs `codex login --with-api-key` once, piping the key
  over stdin so it never shows up in `ps`. It checks `codex login status` first
  and does nothing when a login already exists.
- **Codex ignores `OPENAI_BASE_URL`**. A compatible endpoint has to be declared
  as a provider, and a project-local `.codex/config.toml` will not do: Codex
  reports `model_provider` and `model_providers` as unsupported keys there and
  falls back to `api.openai.com`. So `postAttachCommand.sh` writes the provider
  into the user-level `$CODEX_HOME/config.toml` instead, only when
  `OPENAI_BASE_URL` is set, and skips the write when it is already there.
  Top-level keys go in ahead of the first table header, or TOML reads them as
  members of the existing `[projects.*]` table.
- **The endpoint may not serve Codex's default model**. Set `CODEX_MODEL` on the
  host; it reaches the container through `remoteEnv`/`containerEnv`, and
  `start-agents.sh` passes it on as `--model`. Leave it unset for the default.

### Auto-start

`postAttachCommand.sh` builds the session detached, so all three panes are
already running before anything attaches. `.vscode/tasks.json` then opens the
session on `folderOpen`:

```jsonc
"runOptions": { "runOn": "folderOpen" }
```

It lands in the editor area rather than the panel, because the root
`.vscode/settings.json` sets `"terminal.integrated.defaultLocation": "editor"`.
That key lives only in the root baseline, which Step 2 overwrites, so this holds
only in a project where the Step 2b merge was actually done (§2).
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

A missing `scripts/agents/` is the quieter failure. Both the `folderOpen` task
and `postAttachCommand.sh` guard on `[ -x scripts/agents/start-agents.sh ]`, so
when bootstrap Step 1 has not run the launcher is skipped with no warning at all
and the panes simply never appear (see §2).

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

7. **`.claude/`, `.mcp.json` and similar agent-side config are optional and
   per-example.** Do not add them to every example by default.

8. **`start-agents.sh`, `ask-agent.sh`, `agent-session.sh`, `orchestrator.md`
   and `implementer.md` live once at the repository root, in `scripts/agents/`.**
   They are language-agnostic and were byte-identical across all 13 examples, so
   constraint 2 places them at the root. Edit them in one place; there is nothing
   to propagate.

   The price is the retreat in constraint 1: an example directory alone no longer
   carries them, so bootstrapping needs Step 1 as well as Step 2. That trade is
   deliberate, and it is worth being precise about what was traded. "Maintain a
   single source for these files" is satisfied. "Copy a whole project with one
   command" is not satisfied today — §2 spends six commands on Step 1 alone —
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
