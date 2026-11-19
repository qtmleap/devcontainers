# syntax=docker/dockerfile:1.7
# iOS Tweak / Reverse Engineering environment.
# Bundles Theos + iOS cross-compile toolchain + reverse engineering suite
# (radare2, jadx, Ghidra, ipsw, class-dump, libimobiledevice).
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# The Codex CLI feature uses this directory as its installer CODEX_HOME.
RUN mkdir -p /usr/local/share/codex
ARG _REMOTE_USER_HOME=/home/vscode

# ── Reverse engineering tools + Theos build dependencies ──
RUN \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update && apt-get install -y --no-install-recommends \
    wget unzip jq git-filter-repo \
    radare2 apktool \
    make perl fakeroot zip xz-utils lzma xxd binutils \
    libtinfo6 libxml2 libncurses6 libz3-dev \
    adb android-sdk-platform-tools \
    # libimobiledevice for idevicesyslog / os_log capture over USB.
    # class-dump-style tooling; recon primary.
    libimobiledevice-utils libimobiledevice6 ideviceinstaller libplist-utils \
    # Relay / port forward helpers for jailbroken device sessions.
    socat netcat-openbsd \
    # Mach-O / FAT identification.
    file llvm \
    # Host Swift toolchain runtime / link-time dependencies (swift.org Ubuntu 24.04 list).
    libcurl4-openssl-dev libedit2 libsqlite3-0 libpython3-dev \
    libstdc++-13-dev libncurses-dev zlib1g-dev pkg-config tzdata

# ── jadx (Android APK → Java decompiler) ──
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    JADX_URL=$(wget -qO- https://api.github.com/repos/skylot/jadx/releases/latest | jq -r '.assets[] | select(.name | test("^jadx-[0-9].*\\.zip$")) | .browser_download_url') && \
    JADX_FILE=/var/cache/dl/$(basename "$JADX_URL") && \
    { [ -f "$JADX_FILE" ] || wget -q "$JADX_URL" -O "$JADX_FILE"; } && \
    unzip -q "$JADX_FILE" -d /opt/jadx && \
    ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx && \
    ln -s /opt/jadx/bin/jadx-gui /usr/local/bin/jadx-gui

# ── Ghidra (NSA reverse engineering suite, headless mode) ──
# Usage: analyzeHeadless /tmp/project name -import <binary>
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    GHIDRA_URL=$(wget -qO- https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/latest | jq -r '.assets[] | select(.name | test("PUBLIC.*\\.zip$")) | .browser_download_url') && \
    GHIDRA_FILE=/var/cache/dl/$(basename "$GHIDRA_URL") && \
    { [ -f "$GHIDRA_FILE" ] || wget -q "$GHIDRA_URL" -O "$GHIDRA_FILE"; } && \
    unzip -q "$GHIDRA_FILE" -d /opt && \
    GHIDRA_DIR=$(find /opt -maxdepth 1 -name 'ghidra_*' -type d) && \
    ln -s "$GHIDRA_DIR" /opt/ghidra
ENV PATH="/opt/ghidra/support:$PATH"

# ── ipsw (Go-based Mach-O analyzer) ──
# Usage: ipsw macho info <binary> --class-dump
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    IPSW_URL=$(wget -qO- https://api.github.com/repos/blacktop/ipsw/releases/latest | jq -r --arg arch "$ARCH" '.assets[] | select(.name | test("^ipsw_.*linux_" + $arch + "\\.tar\\.gz$")) | .browser_download_url') && \
    IPSW_FILE=/var/cache/dl/$(basename "$IPSW_URL") && \
    { [ -f "$IPSW_FILE" ] || wget -q "$IPSW_URL" -O "$IPSW_FILE"; } && \
    tar xzf "$IPSW_FILE" -C /usr/local/bin ipsw

# ── yq (mikefarah/yq, Go) ──
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') && \
    YQ_URL=$(wget -qO- https://api.github.com/repos/mikefarah/yq/releases/latest | jq -r --arg arch "$ARCH" '.assets[] | select(.name == "yq_linux_\($arch)") | .browser_download_url') && \
    YQ_FILE=/var/cache/dl/yq_linux_${ARCH} && \
    { [ -f "$YQ_FILE" ] || wget -q "$YQ_URL" -O "$YQ_FILE"; } && \
    install -m 0755 "$YQ_FILE" /usr/local/bin/yq

# ── Theos core ──
USER vscode
ENV THEOS=/home/vscode/theos
RUN git clone --recursive https://github.com/theos/theos.git ${THEOS}

# ── L1ghtmann iOS toolchain (aarch64 support) ──
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    ARCH=$(uname -m) && \
    TC_FILE=/var/cache/dl/iOSToolchain-${ARCH}.tar.xz && \
    { [ -f "$TC_FILE" ] || curl -fsSL -o "$TC_FILE" "https://github.com/L1ghtmann/llvm-project/releases/latest/download/iOSToolchain-${ARCH}.tar.xz"; } && \
    tar xJf "$TC_FILE" -C ${THEOS}/toolchain

# ── kabiroberai Swift toolchain (iOS cross-compile) ──
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    ARCH=$(uname -m) && \
    SWIFT_TC_FILE=/var/cache/dl/swift-5.8-ubuntu22.04-${ARCH}.tar.xz && \
    { [ -f "$SWIFT_TC_FILE" ] || curl -fsSL -o "$SWIFT_TC_FILE" "https://github.com/kabiroberai/swift-toolchain-linux/releases/download/v2.3.0/swift-5.8-ubuntu22.04-${ARCH}.tar.xz"; } && \
    tar xJf "$SWIFT_TC_FILE" -C ${THEOS}/toolchain

# ── Host Swift (for SPM builds that run on the container itself) ──
# Independent of ${THEOS}/toolchain above: that one is the 5.8 iOS cross-compile
# toolchain, this one builds host binaries (swift-format et al.).
USER root
ARG HOST_SWIFT_VERSION=6.3.2
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    # swift.org publishes x86_64 without an arch suffix; aarch64 carries one.
    case "$(uname -m)" in \
    aarch64) SWIFT_PLATFORM=ubuntu2404-aarch64; SWIFT_ARCH=-aarch64 ;; \
    *) SWIFT_PLATFORM=ubuntu2404; SWIFT_ARCH= ;; \
    esac && \
    SWIFT_TAG=swift-${HOST_SWIFT_VERSION}-RELEASE && \
    SWIFT_NAME=${SWIFT_TAG}-ubuntu24.04${SWIFT_ARCH} && \
    HOST_SWIFT_FILE=/var/cache/dl/${SWIFT_NAME}.tar.gz && \
    { [ -f "$HOST_SWIFT_FILE" ] || curl -fsSL -o "$HOST_SWIFT_FILE" "https://download.swift.org/swift-${HOST_SWIFT_VERSION}-release/${SWIFT_PLATFORM}/${SWIFT_TAG}/${SWIFT_NAME}.tar.gz"; } && \
    tar xzf "$HOST_SWIFT_FILE" --strip-components=2 -C /usr
USER vscode

# ── iOS SDKs (15.6 + 16.5 from theos/sdks) ──
RUN \
    --mount=type=cache,target=/var/cache/dl,sharing=locked,uid=1000,gid=1000 \
    SDKS_FILE=/var/cache/dl/theos-sdks-master.tar.gz && \
    { [ -f "$SDKS_FILE" ] || curl -fsSL -o "$SDKS_FILE" "https://github.com/theos/sdks/archive/master.tar.gz"; } && \
    tar xzf "$SDKS_FILE" -C /tmp && \
    mv /tmp/sdks-master/iPhoneOS15.6.sdk ${THEOS}/sdks/ && \
    mv /tmp/sdks-master/iPhoneOS16.5.sdk ${THEOS}/sdks/ && \
    rm -rf /tmp/sdks-master
