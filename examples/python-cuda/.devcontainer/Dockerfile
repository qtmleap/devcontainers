FROM nvidia/cuda:12.9.1-cudnn-runtime-ubuntu24.04

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Keep BuildKit's apt cache mounts populated across builds: docker-clean wipes
# the archives after every install, so drop it and tell apt to keep them.
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
    && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' \
        > /etc/apt/apt.conf.d/keep-cache

# NVIDIA base image is minimal; install the tools required by common-utils and
# subsequent devcontainer features. Everything else (uv, zsh, gh, claude-code,
# direnv, act) is layered on via features in devcontainer.json.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    DEBIAN_FRONTEND=noninteractive apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates curl git git-filter-repo sudo openssh-client tzdata locales \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# Create the non-root vscode user the devcontainer runs as (remoteUser). The
# NVIDIA base is root-only, so unlike the devcontainers base image we make it
# here with passwordless sudo. Its Ubuntu 24.04 layer ships a default `ubuntu`
# account that already holds uid/gid 1000, so it is removed first: without
# this, groupadd exits 4 with "GID '1000' already exists" and the image never
# builds.
RUN if getent passwd $USER_UID >/dev/null; then \
        userdel --remove "$(getent passwd $USER_UID | cut -d: -f1)" 2>/dev/null || true; \
    fi \
    && if getent group $USER_GID >/dev/null; then \
        groupdel "$(getent group $USER_GID | cut -d: -f1)" 2>/dev/null || true; \
    fi \
    && groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME -s /bin/bash \
    && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

USER $USERNAME
