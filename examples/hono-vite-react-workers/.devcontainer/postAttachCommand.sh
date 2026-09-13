#!/bin/zsh

git config --global --unset commit.template
git config --global --add safe.directory /home/vscode/app
git config --global fetch.prune true
git config --global --add --bool push.autoSetupRemote true
git config --global commit.gpgSign false
git branch --merged | egrep -v '\*|develop|main|master' | xargs -r git branch -d || true
[ -f .envrc ] && direnv allow || true

# Build the agent session up front, so the panes are already running by the time
# the folderOpen task attaches to it.
[ -x scripts/agents/start-agents.sh ] && scripts/agents/start-agents.sh --no-attach || true
