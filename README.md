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
# Keep an existing project configuration; copy only the shared config template.
mkdir -p "$TARGET/.codex"
if [ ! -e "$TARGET/.codex/config.toml" ]; then
  cp .codex/config.toml "$TARGET/.codex/config.toml"
fi

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

## 3. Root files (language-agnostic, always copied)

| File | Purpose |
| --- | --- |
| `.codex/config.toml` | Shared gateway/model template. Copy only this file into the target root; credentials and session state are never copied. |
| `.editorconfig` | Indent, EOL, charset. 2-space, LF, UTF-8. `ts/tsx/css/json` use single quotes. |
| `.gitattributes` | Force LF on all text files. Marks lockfiles and `*.gen.ts` as `linguist-generated`. |
| `.commitlintrc.yaml` | Conventional Commits. Enforces `type-enum` (feat/fix/docs/…) and `header-max-length: 128`. |
| `.actrc` | Config for `act` (local GitHub Actions runner). Assumes Apple Silicon (`linux/arm64`) — flip if the host is amd64. |
| `playwright-mcp.config.json` | Browser settings the Playwright MCP server reads at startup: Chromium, an isolated profile, a 1280×720 viewport at `deviceScaleFactor: 2`, screenshots under `screenshots/`. Picked up by the plugin — see §5. |
| `.vscode/settings.json` | Universal VS Code baseline: `formatOnSave`, `files.exclude`, `search.exclude`, file nesting patterns, JSON/YAML formatters. Does **not** define stack-specific formatters. |

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
| `~/.claude` mount | `mounts` | Carries the installed plugins and the Claude login into the container. |
| `playwright-mcp.config.json` | repository root, copied in Step 1 | Browser settings for the Playwright MCP. The plugin passes `--config` when this file exists at the project root and falls back to its own defaults when it does not. |

### Credentials

The examples forward `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`,
`OPENAI_API_KEY`, and `OPENAI_BASE_URL` through `remoteEnv`.
`CLAUDE_CODE_AUTO_MODE_SERVER` is set to `"0"` there as well.

Each example sets `remoteEnv.CODEX_HOME` to `${containerWorkspaceFolder}/.codex`.
Dev Containers expands the variable to the current workspace root, so no
fixed container path is required. The existing `containerEnv.CODEX_HOME` entries
use the same variable. For these Compose-based examples, `remoteEnv` is the
active VS Code environment setting; container-wide variables belong in Compose. Codex therefore reads the
copied `.codex/config.toml` as its user configuration, including the `gateway`
provider, `codex,gpt-6.1-sol` model, and `low` reasoning effort. The gateway
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
   **and** Step 2 together, never Step 2 alone.

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

   `playwright-mcp.config.json` is the one file that stays, and it is not a
   server: it is per-project browser settings that the plugin reads when it is
   present. It is configuration for a tool, in the same category as
   `.editorconfig`.

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
