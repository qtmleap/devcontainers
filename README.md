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
them as errors. The container covers `swift-format`, the coding agents and any
SDK-independent code; compiling, testing and signing stay on a Mac. Its
`integration.yaml` therefore ships lint only, with the macOS build job left as a
documented per-project addition.
Native app projects also adopt the shared iOS skill in bootstrap Step 2a.

---

## 2. Bootstrap procedure

Given a target project directory `$TARGET`, run all of the steps below **before
opening the workspace in VS Code**, so that the container is built once from a
complete `.devcontainer/` rather than rebuilt after the fact.

```bash
# Step 1: copy root shared configuration
cp -a .editorconfig      "$TARGET/"
cp -a .gitattributes     "$TARGET/"
cp -a .commitlintrc.yaml "$TARGET/"
cp -a .actrc             "$TARGET/"
cp -a playwright-mcp.config.json "$TARGET/"
cp -a .vscode            "$TARGET/"
# Keep existing project instructions, including symbolic links.
if [ ! -e "$TARGET/AGENTS.md" ] && [ ! -L "$TARGET/AGENTS.md" ]; then
  cp -a AGENTS.md "$TARGET/"
fi
# Keep an existing project configuration; copy only the shared config template.
mkdir -p "$TARGET/.codex"
if [ ! -e "$TARGET/.codex/config.toml" ]; then
  cp .codex/config.toml "$TARGET/.codex/config.toml"
fi

# Step 2: copy the chosen example (the `/.` suffix includes dotfiles)
# This OVERWRITES .vscode/settings.json with the example's stack-specific one,
# discarding the root baseline that Step 1 just installed.
EXAMPLE='<name>'
cp -a "examples/$EXAMPLE/." "$TARGET/"

# Step 2a (examples/swift-ios-app ONLY): install the instruction-only iOS skill.
# Keep an existing skill (directory, file or symlink) and refuse to write through
# a symlinked .agents or .agents/skills parent. Failures are reported, not hidden.
if [ "$EXAMPLE" = 'swift-ios-app' ]; then
  SKILL_DST="$TARGET/.agents/skills/ios-development"
  if [ -L "$TARGET/.agents" ] || [ -L "$TARGET/.agents/skills" ]; then
    echo "SKIPPED: ios-development was not installed; skill parent is a symlink. Adopt manually." >&2
  elif [ -e "$SKILL_DST" ] || [ -L "$SKILL_DST" ]; then
    echo "KEPT existing $SKILL_DST; contents unverified. Compare with diff -r (see §3)." >&2
  else
    mkdir -p "$TARGET/.agents/skills" \
      && cp -a .agents/skills/ios-development "$SKILL_DST" \
      || { echo "FAILED to install ios-development skill" >&2; exit 1; }
  fi
fi

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

If the target already has `AGENTS.md`, merge the `development-orchestration`
block from the shared [AGENTS.md](AGENTS.md) into it by hand. When refreshing an
existing copy, replace that marked block instead of appending it again. Preserve
project-specific instructions and the managed commit-policy blocks installed by
CommitGuard. The shared file contains only the development routine; it does not
duplicate CommitGuard's managed policy.

**Step 2b, in detail.** An example's `.vscode/settings.json` carries only
stack-specific keys — ten to twelve of them, the `[typescript]` / `[python]` /
`[rust]` formatter bindings and similar — while the root baseline installed in
Step 1 carries 31. Because Step 2 replaces the file rather than merging it, 29
to 31 of those root keys are lost, depending on the example. Nothing reports
this: the editor simply stops trimming whitespace, hiding `node_modules` and
nesting files, so skipping this step degrades the setup quietly rather than
loudly.

Merge the two by hand: start from the root baseline and fold the example's keys
into it. There is deliberately no tooling for this. Both files are JSONC with
comments, which `jq` cannot parse at all, let alone merge; and adding a
JSONC-aware merge tool would cost the bootstrap the property that makes it
portable — that it is nothing but `cp`.

Do **not** copy this repository's own `LICENSE`, `README.md`, or `.gitignore`
into the target project. Those are metadata for this template repository, not
for downstream users.

---

## 3. Root files (language-agnostic shared configuration)

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Portable parallel-development, verification, Tailscale preview, UI/store screenshot, ASC tool, named review routing (LocalGPT / Claude Code / LocalMCP / Codex), and App Review follow-up policy. Copy when absent; merge the marked block into existing project instructions. |
| `.agents/skills/ios-development/` | Instruction-only native iOS/iPadOS workflow, test policy, release policy (TestFlight / submission / launch), and App Review follow-up reference. Copied only for `swift-ios-app` by Step 2a; see adoption and refresh below. |
| `.codex/config.toml` | Shared gateway/model template. Copy only this file into the target root; credentials and session state are never copied. |
| `.editorconfig` | Indent, EOL, charset. 2-space, LF, UTF-8. `ts/tsx/css/json` use single quotes. |
| `.gitattributes` | Force LF on all text files. Marks lockfiles and `*.gen.ts` as `linguist-generated`. |
| `.commitlintrc.yaml` | Conventional Commits. Enforces `type-enum` (feat/fix/docs/…) and `header-max-length: 128`. |
| `.actrc` | Config for `act` (local GitHub Actions runner). Assumes Apple Silicon (`linux/arm64`) — flip if the host is amd64. |
| `playwright-mcp.config.json` | Browser settings the Playwright MCP server reads at startup: Chromium, an isolated profile, a 1280×720 viewport at `deviceScaleFactor: 2`, screenshots under `screenshots/`. Picked up by the plugin — see §5. |
| `.vscode/settings.json` | Universal VS Code baseline: `formatOnSave`, `files.exclude`, `search.exclude`, file nesting patterns, JSON/YAML formatters. Does **not** define stack-specific formatters. |

Root `.gitignore` and `LICENSE` and `README.md` are for maintaining this
repository itself and are not copied into downstream projects.

### Native iOS skill adoption and refresh

Codex discovers repository skills in `.agents/skills`; see the
[official skills documentation](https://learn.chatgpt.com/docs/build-skills).
After Step 2a, invoke `$ios-development`, or tell another agent to read
`.agents/skills/ios-development/SKILL.md` explicitly. This does not rely on
Claude discovering that directory or write to mounted `.claude`/`.codex` state.

Step 2a keeps existing skills and reports symlinked parent directories for manual
adoption. For an existing project, merge the shared AGENTS block as described in
section 2 as well. Before refreshing a skill, run from the root of this checkout
with `TARGET` set to the target project:
`diff -r .agents/skills/ios-development "$TARGET/.agents/skills/ios-development"`.
Merge explicitly, preserve local edits and symlinks, and record the source Git
revision with the project's existing setup notes. There is no automatic sync.

Future App Review submissions get a monitor and scoped rejection follow-up per
`references/app-review-followup.md`; the template installs no jobs and adoption
grants no Apple-write authority. Existing copies must explicitly merge the new
references, `SKILL.md` and the AGENTS block (including review routing); nothing
autosyncs. Include `references/release-policy.md` when merging. Release-policy
adoption grants no Apple write, notification or release authority.

The shared AGENTS block also covers topic-session reuse, bounded review requests
and evidence reuse. When the discovered Claude MCP supports review-session
resume, agents use its explicit review/resume fields and a native diff manifest.
The template installs no runtime engine; it does not infer resume support or
provider cache savings from a job receipt. Usage and cache evidence must come
from the actual tool, with invocation and cumulative figures kept distinct.

UI mock tooling is optional. If a project already uses a mock-first workflow and
mock viewer, agents read and follow it; the mock-diff plugin lives in
`qtmleap/claude-plugins`, is not duplicated here, and is not required to be
installed.

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

No example carries agent tooling. The agents come from the user's own Claude
Code installation, not from anything this repository copies (see §5).
`examples/swift-ios-tweak-jailed/` is the only example carrying a `scripts/`
directory, and it holds iOS build assets.

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

## 5. Coding agents (Claude Code + plugin MCP servers)

This repository installs the agent **CLIs** and the things they need from the
container, and nothing else. It ships no role prompts, no launcher, and no
`.mcp.json`. Orchestration and MCP servers both come from
[qtmleap/claude-plugins](https://github.com/qtmleap/claude-plugins), which
installs into the user's own `~/.claude` and is bind-mounted into every
container — so a plugin updated on the host is updated in every project at once.

Talk to Claude Code directly. Where work benefits from being split up, the
plugins' own agents (`devflow:orchestrator`, `devflow:implementer`,
`devflow:reviewer` and the rest) run as subagents inside that one session.
There are no separate seats to start and nothing to attach to.

### What provides what

| Piece | Where | Purpose |
| --- | --- | --- |
| Claude Code | `features` → `stu-bell/devcontainer-features/claude-code` | Installs `claude`. |
| Codex CLI | `features` → `thamaji/devcontainer-features/codex-cli` | Installs `codex`. The devflow plugin's MCP server runs `codex exec` for a tool call; without the CLI on `PATH` every call answers "codex is not installed". |
| Bun | `features` → `shyim/devcontainers-features/bun` | Runs the plugins' MCP servers, which are Bun scripts. |
| CommitGuard | `features` → `tkgstrator/commitguard` | Guarded `git` for the workspace repository; see [Guarded Git](#guarded-git-commitguard). |
| `~/.claude` mount | `mounts` | Carries the installed plugins and the Claude login into the container. |
| `playwright-mcp.config.json` | repository root, copied in Step 1 | Browser settings for the Playwright MCP. The plugin passes `--config` when this file exists at the project root and falls back to its own defaults when it does not. |

### Credentials

The examples forward `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`,
`OPENAI_API_KEY`, and `OPENAI_BASE_URL` through `remoteEnv`.
`CLAUDE_CODE_AUTO_MODE_SERVER` is set to `"0"` there as well. They also set
`ANTHROPIC_MODEL` there, defaulting to `claude-sonnet-5-5` so Claude Code
starts on Sonnet 5.5. Defining `ANTHROPIC_MODEL` on the host overrides the
default, and `--model` or `/model` still override it for a single session.

Each example sets `remoteEnv.CODEX_HOME` to `${containerWorkspaceFolder}/.codex`.
Dev Containers expands the variable to the current workspace root, so no
fixed container path is required. The existing `containerEnv.CODEX_HOME` entries
use the same variable. For these Compose-based examples, `remoteEnv` is the
active VS Code environment setting; container-wide variables belong in Compose. Codex therefore reads the
copied `.codex/config.toml` as its user configuration, including the `gateway`
provider, `gpt-6.1-sol` model, and `xhigh` reasoning effort. The gateway
provider reads its API key from `OPENAI_API_KEY`; no key is stored in the
template. A command-line model override can still override this default.

This repository tracks only the shared `.codex/config.toml` template. Each
example's `.gitignore` excludes the target project's entire `.codex/`
directory, including its local configuration, credentials, and session state.
Lifecycle hooks do not create or rewrite Codex configuration on the host or in
the project. To use the same configuration from a host shell, run
`CODEX_HOME="$PWD/.codex" codex` from the project root.

The existing host `~/.claude` and `~/.codex` bind mounts remain available, but
Codex launched with the workspace `CODEX_HOME` uses the project's directory.

### Guarded Git (commitguard)

Every example installs the Dev Container Feature
[`ghcr.io/tkgstrator/commitguard:1`](https://github.com/tkgstrator/commitlint-rust/tree/master/features/commitguard).
Keep the `:1` tag: never `:latest`, and never the retired
`ghcr.io/tkgstrator/commitlint-rust/...` namespace. It installs `commitguard` and
`commitlint-rust`, and on every container create and start activates a guarded
`git` for the workspace repository. Commits and pushes must carry the identity of
the authenticated human `github.com` `gh` account and pass the commit message
policy. It supports Debian/Ubuntu on amd64/arm64; every example qualifies,
including the Swift ones (Ubuntu 24.04 `noble`).

Setup:

1. The workspace must already be a Git repository when the container opens
   (`git init` first for a new project).
2. A human `github.com` login in `gh` must be visible inside the container. The
   examples mount `~/.config/gh` read-only, so run `gh auth login -h github.com`
   on the host. A token that lives only in the host's OS keychain is not visible
   to the container.
3. Rebuild the container. Adding the Feature to an existing project needs a
   rebuild; it does not take effect on a running container.

Fail-closed: when activation fails (no repository, no human login, unsafe layout),
ordinary `git` refuses to run and prints instructions. Dev Containers also skips
the lifecycle commands that follow the failed one, including the example's
`onCreateCommand` and `postCreateCommand.sh`. After logging in on the host, run
`commitguard-devcontainer-setup` inside the container to retry activation, and
`commitguard --strict account` to refresh a missing or changed identity cache.
That restores Git only; use Rebuild Container to run the skipped lifecycle
commands.

What it writes:

- `.codex/skills/gh-commit-identity` and `.claude/skills/gh-commit-identity` in
  the workspace. These are generated binaries, already excluded by each example's
  `.gitignore` (`.claude/`, `.codex/`).
- A managed policy block in the workspace `AGENTS.md` and `CLAUDE.md`. These
  files are not ignored; review them before committing.
- Global Git configuration and shell startup files, in the container's private
  `HOME` only.

The host `~/.claude` and `~/.codex` bind mounts are never touched, and this
repository's mounts are unchanged. The guard covers shells whose `PATH` includes
the Feature directory; an absolute `/usr/bin/git` bypasses it.

### Browsers

The four browser-capable examples (`hono-vite-react-node`,
`hono-vite-react-workers`, `hono-vite-react-workers-prisma`, `vinext`) carry
`playwright` and `@playwright/mcp` in `devDependencies`. Their
`postCreateCommand.sh` also installs Chromium and its system libraries, which
the image does not carry; without that step the first `browser_navigate`
returns `Browser "chromium" is not installed`. That block is guarded on
`playwright-mcp.config.json`, so it is inert in a project with no browser work.

A Python, Rust or Swift project that wants a browser needs
`bunx @playwright/mcp install-browser --with-deps chromium` run once by hand.

A connected MCP server says nothing about a browser being present: the server
starts fine and fails at the first navigation.

### Codex tuning

These are read by the plugin's MCP server, not by anything in this repository.
Only `CODEX_MODEL` is forwarded by the examples; set the rest on the host and
add them to `remoteEnv` if a project needs them.

| Variable | Effect |
| --- | --- |
| `CODEX_MODEL` | Model for MCP-launched Codex turns. Default: whatever Codex selects. A tool call may still name its own model. |
| `CODEX_MCP_ARGS` | Arguments shared by `codex exec`, `exec resume`, and `exec review`. Default: `--dangerously-bypass-approvals-and-sandbox`. |
| `CODEX_MCP_TIMEOUT_MS` | Maximum time for one Codex turn. Default: 600000. |
| `CODEX_MCP_MAX_CHARS` | Maximum returned answer length. Default: 20000. |

> The permissive default treats the devcontainer as the sandbox, but it still
> receives host credentials, writable configuration mounts, and usually the
> host Docker socket. Override `CODEX_MCP_ARGS` if that is wider access than
> the project should have.

---

## 6. Design constraints

Rules for any agent modifying this repository:

1. **Examples must stay copyable as-is, combined with the root shared files.**
   Do not introduce shared base configuration under `examples/_shared/`,
   `examples/_base/`, symlinks, or generation scripts. Nothing under `examples/`
   may require resolution or generation at copy time.

   An example directory is still not a whole project on its own: the root
   shared files of §3 have no per-example copies. A complete project is Step 1
   **and** Step 2 together, never Step 2 alone. For `swift-ios-app`, Step 2 includes
   the shared skill adoption in Step 2a.

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

5. **`AGENTS.md`, `.editorconfig`, `.gitattributes`, `.commitlintrc.yaml`, `.actrc` are
   root-only.** Do not duplicate these files inside example folders under any
   circumstance.

6. **`_shared/`, `common/`, `base/` directories are prohibited under
   `examples/`.** The one exception is a possible future `_template/`
   directory as a *starting point for creating new examples* — this is a
   snapshot, not a runtime dependency.

7. **Project-specific `.claude/` configuration is optional and per-example.**

8. **Agent tooling does not live in this repository.** No `.mcp.json`, no role
   prompts, no launcher, no command-palette extension — those come from
   qtmleap/claude-plugins, which the user installs once into `~/.claude` (§5).
   This repository's job stops at installing the CLIs they call and mounting
   the directory they live in.

   A copy distributed here would be a second copy: the plugins hold the
   originals, and the two drift the moment one side is edited. That is what
   happened with the Codex MCP bridge, which existed in both places and started
   two servers in every session. Do not reinstate a repository-local
   `.mcp.json`; if a plugin is missing something, fix the plugin.

   Instruction-only skill sources are allowed at the root under `.agents/skills/`
   (currently `ios-development`). They hold no scripts, runners, servers or
   dependencies, are tracked and portable, and live only there: no per-example
   copies, none inside ignored or mounted `.codex/` or `.claude/`, no symlinks.
   This runtime-specific source is a scoped exception to rule 2; it is loaded and
   copied only when the native iOS example is selected. Tooling, servers and
   roles stay in the plugins.

   Root `AGENTS.md` is allowed as portable shared policy text. Keep it independent
   of host-specific paths and installed tool state; discover capabilities on the
   execution host. Agent implementations, role prompts, servers and launchers
   continue to live in the plugins.

   The shared `playwright-mcp.config.json` contains per-project browser settings
   that the plugin reads when it is present. It is configuration for a tool, in
   the same category as `.editorconfig`.

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
