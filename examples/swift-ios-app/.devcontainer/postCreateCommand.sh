#!/bin/zsh
set -e

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

# Resolve SPM dependencies if the project has a package manifest of its own.
# Packages that depend on the iOS SDK will not resolve here; that is expected.
if [ -f Package.swift ]; then
  swift package resolve || true
fi
