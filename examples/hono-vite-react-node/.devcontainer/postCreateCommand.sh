#!/bin/zsh
set -e

sudo chown -R $(whoami):$(whoami) node_modules 2>/dev/null || true

# Silence direnv output.
# In direnv 2.36+, DIRENV_LOG_FORMAT env var is ignored unless direnv.toml exists.
# See: https://github.com/direnv/direnv/issues/1418
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[global]
log_format = ""
hide_env_diff = true
EOF

# Install deps if package.json exists.
if [ -f package.json ]; then
  if [ -f bun.lock ]; then
    bun install --frozen-lockfile --ignore-scripts
  else
    bun install --ignore-scripts
  fi
fi

# Playwright MCP drives a real Chromium, and neither the browser nor its system
# libraries ship in the image, so the first `browser_navigate` fails with
# `Browser "chromium" is not installed` until both are installed here.
#
# The two Playwright packages in devDependencies look for different Chromium
# revisions: @playwright/mcp bundles its own, newer Playwright build. Each one
# therefore installs its own browser. bunx runs the copy in node_modules, so
# the revisions follow the versions pinned in package.json, and the playwright
# plugin runs that same @playwright/mcp version. `--with-deps` also brings the
# system libraries and fonts, Japanese included, which both browsers share.
if [ -d node_modules/@playwright/mcp ]; then
  bunx @playwright/mcp install-browser --with-deps chromium
fi
if [ -d node_modules/playwright ]; then
  bunx playwright install chromium
fi
