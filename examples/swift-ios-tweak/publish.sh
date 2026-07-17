#!/usr/bin/env bash
# Build the swift-ios-tweak devcontainer image locally and push it to GHCR.
# iOS dev happens on Apple Silicon → we ship arm64-native only. devcontainers/cli
# #106 blocks multi-arch push when features are used, so this script skips the CI
# path entirely and just builds for the host arch, then pushes.
#
# Requires: bun, docker, gh CLI (already logged in for token).
# @devcontainers/cli is run via bunx — no global install needed.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
IMAGE_NAME="ghcr.io/qtmleap/devcontainer-swift-ios-tweak"
SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"

command -v bun >/dev/null || {
  echo "bun not found. Install: https://bun.sh" >&2
  exit 1
}

echo "==> Logging in to ghcr.io via gh"
gh auth token | docker login ghcr.io -u "$(gh api user --jq .login)" --password-stdin

echo "==> Building devcontainer image (host arch, features expanded)"
bunx @devcontainers/cli build \
  --workspace-folder "$HERE" \
  --image-name "$IMAGE_NAME:latest" \
  --image-name "$IMAGE_NAME:$SHA"

echo "==> Pushing to GHCR"
docker push "$IMAGE_NAME:latest"
docker push "$IMAGE_NAME:$SHA"

echo "Done: $IMAGE_NAME:{latest,$SHA}"
