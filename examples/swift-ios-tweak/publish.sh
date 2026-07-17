#!/usr/bin/env bash
# Build the swift-ios-tweak devcontainer image locally and push it to GHCR.
# iOS dev happens on Apple Silicon → we ship arm64-native only. devcontainers/cli
# #106 blocks multi-arch push when features are used, so this script skips the CI
# path entirely and just builds for the host arch, then pushes.
#
# Requires: @devcontainers/cli, docker, gh CLI (already logged in for token).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE_NAME="ghcr.io/qtmleap/devcontainer-swift-ios-tweak"
SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"

command -v devcontainer >/dev/null || {
  echo "devcontainer CLI not found. Install: npm i -g @devcontainers/cli" >&2
  exit 1
}

echo "==> Logging in to ghcr.io via gh"
gh auth token | docker login ghcr.io -u "$(gh api user --jq .login)" --password-stdin

echo "==> Building devcontainer image (host arch, features expanded)"
devcontainer build \
  --workspace-folder "$HERE" \
  --image-name "$IMAGE_NAME:latest" \
  --image-name "$IMAGE_NAME:$SHA"

echo "==> Pushing to GHCR"
docker push "$IMAGE_NAME:latest"
docker push "$IMAGE_NAME:$SHA"

echo "Done: $IMAGE_NAME:{latest,$SHA}"
