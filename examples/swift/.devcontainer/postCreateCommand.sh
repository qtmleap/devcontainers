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

sudo chown -R $(whoami):$(whoami) .build 2>/dev/null || true

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

# Resolve SPM dependencies if a project already exists.
if [ -f Package.swift ]; then
  swift package resolve
fi
