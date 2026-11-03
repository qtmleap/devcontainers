#!/bin/zsh
set -e

# Keep oh-my-zsh's completion cache from being group/other-writable.
# Processes started via `docker exec` can run with umask 0000, so the
# cache/completions directory oh-my-zsh creates on first run ends up 777 and
# compinit refuses to load completions ("Insecure completion-dependent
# directories"). Creating it first with sane permissions lets oh-my-zsh's own
# `mkdir -p` reuse it as-is.
if [ -d "$HOME/.oh-my-zsh" ]; then
  mkdir -p "$HOME/.oh-my-zsh/cache/completions"
  chmod -R go-w "$HOME/.oh-my-zsh/cache"
fi

sudo chown -R $(whoami):$(whoami) target 2>/dev/null || true
sudo chown -R $(whoami):$(whoami) ~/.cargo 2>/dev/null || true
sudo chown -R $(whoami):$(whoami) /usr/local/cargo 2>/dev/null || true

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

# Prefetch dependencies if a compilable project exists (Cargo.toml + a source
# target). `cargo fetch` on a bare Cargo.toml with no src/ errors out.
if [ -f Cargo.toml ] && { [ -d src ] || grep -q '^\[workspace\]' Cargo.toml; }; then
  cargo fetch
fi
