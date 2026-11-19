# Official Swift image (based on Ubuntu 24.04 "noble"). Ships swift, swiftc,
# swift-format, LLDB, and SPM out of the box.
#
# This container cannot build the app. An iOS/macOS app built from an Xcode
# project needs Xcode, the Apple SDKs and a simulator, none of which exist on
# linux, and `import SwiftUI` / `import UIKit` do not resolve here. What it does
# give you is swift-format (SwiftSyntax only, no SDK required), a linux Swift
# toolchain for any SDK-independent code, and the agent tooling. Compilation,
# tests and signing stay on a Mac.
FROM swift:6.0-noble

# The Codex CLI feature uses this directory as its installer CODEX_HOME.
RUN mkdir -p /usr/local/share/codex

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && DEBIAN_FRONTEND=noninteractive apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl git git-filter-repo sudo openssh-client zsh tzdata locales \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# The swift base image is root-only; create the vscode user devcontainer runs as.
# Ubuntu 24.04 ("noble") ships a default `ubuntu` account that already holds
# uid/gid 1000, so it is removed first: without this, groupadd exits 4 with
# "GID '1000' already exists" and the image never builds.
RUN if getent passwd $USER_UID >/dev/null; then \
        userdel --remove "$(getent passwd $USER_UID | cut -d: -f1)" 2>/dev/null || true; \
    fi \
    && if getent group $USER_GID >/dev/null; then \
        groupdel "$(getent group $USER_GID | cut -d: -f1)" 2>/dev/null || true; \
    fi \
    && groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME -s /usr/bin/zsh \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

USER $USERNAME
