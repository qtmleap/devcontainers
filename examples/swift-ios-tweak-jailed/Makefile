# ===========================================================================
# Theos tweak Makefile — template.
#
# Only $(TWEAK_NAME) (via control's `Name:`) and the target app knobs below
# should need editing per project. Everything downstream — source discovery,
# defines, filter plist lookup — is derived from it.
#
# Targets:
#   make            — JB rootless .deb (MSHookFunction via libsubstrate)
#   make package    — same, packaged
#   make install    — install .deb to $(THEOS_DEVICE_IP) (dpkg path)
#   make jailed     — Dobby-static .dylib for Sideloadly / TrollStore.
#                     Strict-linked (undefined symbols fail the build).
#                     Requires vendor/dobby/{include,lib/libdobby.a}.
#   make ipa        — Assemble a patched IPA from $(DECRYPTED_IPA) by
#                     injecting the jailed dylib via LC_LOAD_DYLIB.
#   make deploy     — Build the IPA, scp to $(THEOS_DEVICE_IP), install via
#                     trollstorehelper, then launch $(TARGET_BUNDLE_ID).
#   make agent      — Compile frida/agent.ts → frida/dist/agent.js.
#   make attach     — Compile the agent, then run `frida -U -f
#                     $(TARGET_BUNDLE_ID) -l frida/dist/agent.js`.
#   make format     — clang-format every ObjC / C source under Sources/.
#   make format-check — dry-run clang-format; nonzero exit on any diff.
#   make hooks      — Point git core.hooksPath at scripts/.
# ===========================================================================

# ---------------------------------------------------------------------------
# PROJECT VARIABLES
# ---------------------------------------------------------------------------
# TWEAK_NAME is pulled from control's `Name:` field. Keep that value as a
# single identifier (CamelCase, no spaces) — it's used as the dylib name,
# the sources directory, and the filter plist basename.
TWEAK_NAME               := $(shell awk -F': *' '/^Name:/ {print $$2; exit}' control)
TWEAK_SOURCES_DIR        := Sources/$(TWEAK_NAME)

# The tweak filter lives at Tweak.plist for template hygiene, but Theos
# + MobileSubstrate both key off $(TWEAK_NAME).plist (Theos to stage it,
# MobileSubstrate to match it against the dylib basename). Recreate the
# symlink at parse time so it stays fresh across TWEAK_NAME changes.
# Skip when TWEAK_NAME is literally `Tweak` — self-symlinking would clobber
# the source file.
_PLIST_SYMLINK           := $(shell [ -f Tweak.plist ] && [ "$(TWEAK_NAME)" != "Tweak" ] \
                                    && ln -sfn Tweak.plist $(TWEAK_NAME).plist)

# Fill in the app you're hooking. Overridable via .env or the command line.
TARGET_PROCESS           ?=
TARGET_BUNDLE_ID         ?=

# Decrypted IPA the ipa/deploy pipeline consumes. App Store IPAs ship
# FairPlay-encrypted; you need a frida-ios-dump-style decrypted copy.
# Never commit this file (see .gitignore).
DECRYPTED_IPA            ?= $(CURDIR)/assets/App.ipa

# ---------------------------------------------------------------------------
# Theos boilerplate.
# ---------------------------------------------------------------------------
TARGET                   := iphone:clang:16.5:14.0
INSTALL_TARGET_PROCESSES := $(TARGET_PROCESS)
ARCHS                    := arm64
THEOS_PACKAGE_SCHEME     := rootless
-include .env

# Devcontainer default: reach the host Mac's iproxy relay (usb-tethered
# device on port 22 → host port 2222). Override in .env for physical Wi-Fi
# deployments (e.g. THEOS_DEVICE_IP=192.168.x.x, THEOS_DEVICE_PORT=22).
THEOS_DEVICE_IP          ?= host.docker.internal
THEOS_DEVICE_PORT        ?= 2222

include $(THEOS)/makefiles/common.mk

# Auto-discover tweak sources under Sources/$(TWEAK_NAME)/.
$(TWEAK_NAME)_FILES      := $(shell find $(TWEAK_SOURCES_DIR) \
    \( -name '*.x' -o -name '*.xm' -o -name '*.m' -o -name '*.mm' \
       -o -name '*.c' -o -name '*.cpp' -o -name '*.swift' \))
# fishhook — 2-file drop-in for C-symbol rebinding. Vendored at
# vendor/fishhook/; no build system, just compile the .c alongside ours.
$(TWEAK_NAME)_FILES      += vendor/fishhook/fishhook.c

BUILD_COMMIT             ?= $(shell git rev-parse --short=7 HEAD 2>/dev/null || echo unknown)

_CONTROL_VERSION         := $(shell grep '^Version:' control | awk '{print $$2}')
# Theos sets DEBUG=1 by default; FINALPACKAGE=1 clears it for release builds.
ifneq ($(FINALPACKAGE),1)
PACKAGE_VERSION          := $(_CONTROL_VERSION)-dbg
else
PACKAGE_VERSION          := $(_CONTROL_VERSION)
endif
# `override` needed because Theos's package/deb.mk re-assigns
# THEOS_PACKAGE_BASE_VERSION from the control file's raw Version:
# without the -dbg suffix. Pinning it here keeps the debug suffix on
# the .deb filename for non-FINALPACKAGE builds.
ifneq ($(FINALPACKAGE),1)
override THEOS_PACKAGE_BASE_VERSION := $(_CONTROL_VERSION)-dbg
else
override THEOS_PACKAGE_BASE_VERSION := $(_CONTROL_VERSION)
endif

$(TWEAK_NAME)_CFLAGS     := -fobjc-arc -Wno-unused-function \
                            -DTWEAK_COMMIT=\"$(BUILD_COMMIT)\" \
                            -DTWEAK_VERSION=\"$(PACKAGE_VERSION)\" \
                            -Ivendor/fishhook -I$(TWEAK_SOURCES_DIR)

$(TWEAK_NAME)_FRAMEWORKS := Foundation UIKit

# ---------------------------------------------------------------------------
# Hook backend: substrate (JB) vs Dobby (jailed / Sideloadly / TrollStore).
# ---------------------------------------------------------------------------
ifeq ($(JAILED),1)
    # No substrate at runtime → strict-link so a stray MSHookMessageEx-style
    # call can't slip through and crash the injected app at dyld load.
    $(TWEAK_NAME)_CFLAGS     += -DIPA_JAILED=1 -Ivendor/dobby/include
    $(TWEAK_NAME)_LDFLAGS    := -Lvendor/dobby/lib -ldobby -lc++ -lc++abi \
                                -Wl,-undefined,error
else
    $(TWEAK_NAME)_LDFLAGS    := -lsubstrate
endif

include $(THEOS_MAKE_PATH)/tweak.mk

after-install::
	install.exec "chmod 755 /var/jb/Library/MobileSubstrate/DynamicLibraries/$(TWEAK_NAME).dylib"

# ---------------------------------------------------------------------------
# Sideload build — Dobby-static dylib, no libsubstrate dependency. Drops
# the artifact into packages/jailed/ and dumps otool -L so a stray dyld
# dependency is immediately visible.
# ---------------------------------------------------------------------------
.PHONY: jailed
jailed::
	$(MAKE) JAILED=1 clean
	$(MAKE) JAILED=1 all
	$(ECHO_NOTHING)mkdir -p packages/jailed$(ECHO_END)
	$(ECHO_NOTHING)cp $(THEOS_OBJ_DIR)/$(TWEAK_NAME).dylib packages/jailed/$(TWEAK_NAME).dylib$(ECHO_END)
	@echo "jailed dylib -> packages/jailed/$(TWEAK_NAME).dylib"
	@echo "--- otool -L (must NOT list libsubstrate or libdobby) ---"
	@$(THEOS)/toolchain/linux/iphone/bin/otool -L packages/jailed/$(TWEAK_NAME).dylib 2>/dev/null \
	  || otool -L packages/jailed/$(TWEAK_NAME).dylib 2>/dev/null \
	  || echo "(otool unavailable)"

# ---------------------------------------------------------------------------
# IPA assembly. Injects the jailed dylib into $(DECRYPTED_IPA) via
# LC_LOAD_DYLIB and repacks. Output goes to packages/ipa/.
# ---------------------------------------------------------------------------
JAILED_DYLIB             := $(CURDIR)/packages/jailed/$(TWEAK_NAME).dylib
IPA_OUT                  := $(CURDIR)/packages/ipa/$(TWEAK_NAME).ipa

.PHONY: ipa
ipa:: jailed
	@if [ ! -f "$(DECRYPTED_IPA)" ]; then \
	  echo "error: decrypted IPA missing at $(DECRYPTED_IPA)"; \
	  echo "       override with: make ipa DECRYPTED_IPA=/path/to/decrypted.ipa"; \
	  exit 1; \
	fi
	@echo "==> assembling patched IPA from $(DECRYPTED_IPA)"
	uv run python scripts/build_ipa.py \
	  --input  "$(DECRYPTED_IPA)" \
	  --dylib  "$(JAILED_DYLIB)" \
	  --output "$(IPA_OUT)"

# ---------------------------------------------------------------------------
# Deploy — scp the patched IPA to the JB device, install via TrollStore /
# TrollStore Lite's `trollstorehelper install-ipa`, then launch
# $(TARGET_BUNDLE_ID) via uiopen (falls back to `open`).
#
# Assumes:
#   - SSH reachable at $(THEOS_DEVICE_IP):$(THEOS_DEVICE_PORT) as $(DEPLOY_USER).
#   - trollstorehelper on device $PATH (TrollStore >= 2.x or Lite).
#   - uiopen present for URL-scheme launches (fallback: `open <bundle-id>`).
# ---------------------------------------------------------------------------
DEPLOY_USER              ?= mobile
DEPLOY_STAGE             ?= /var/mobile/Documents
_SSH_CMD                  = ssh -p $(THEOS_DEVICE_PORT) -o StrictHostKeyChecking=accept-new \
                                $(DEPLOY_USER)@$(THEOS_DEVICE_IP)
_SCP_CMD                  = scp -P $(THEOS_DEVICE_PORT) -o StrictHostKeyChecking=accept-new

.PHONY: deploy
deploy:: ipa
	@if [ -z "$(TARGET_BUNDLE_ID)" ]; then \
	  echo "error: TARGET_BUNDLE_ID unset — required for deploy launch step."; \
	  echo "       set in .env or on the command line."; \
	  exit 1; \
	fi
	@echo "==> uploading $(notdir $(IPA_OUT)) to $(DEPLOY_USER)@$(THEOS_DEVICE_IP):$(THEOS_DEVICE_PORT)"
	$(_SCP_CMD) "$(IPA_OUT)" $(DEPLOY_USER)@$(THEOS_DEVICE_IP):$(DEPLOY_STAGE)/
	@echo "==> installing via TrollStore/Lite"
	$(_SSH_CMD) 'trollstorehelper install-ipa $(DEPLOY_STAGE)/$(notdir $(IPA_OUT))'
	@echo "==> launching $(TARGET_BUNDLE_ID)"
	$(_SSH_CMD) 'uiopen "$(TARGET_BUNDLE_ID)://" 2>/dev/null \
	              || open $(TARGET_BUNDLE_ID) 2>/dev/null \
	              || echo "no launcher on device; open the app from SpringBoard"'

# ---------------------------------------------------------------------------
# Frida investigation agent. TypeScript source under frida/agent.ts is
# bundled by frida-compile into frida/dist/agent.js, then injected into
# the target by the Python frida CLI (`uv run frida ...`).
#
# The Frida controller side lives in Python (pyproject.toml pulls in
# frida + frida-tools); the agent side is TypeScript (package.json pulls
# in frida-compile + @types/frida-gum). Both toolchains ship in the
# devcontainer.
# ---------------------------------------------------------------------------
FRIDA_SRC                := frida/agent.ts
FRIDA_OUT                := frida/dist/agent.js

.PHONY: agent
agent:
	bunx frida-compile $(FRIDA_SRC) -o $(FRIDA_OUT)

.PHONY: attach
attach: agent
	@if [ -z "$(TARGET_BUNDLE_ID)" ]; then \
	  echo "TARGET_BUNDLE_ID required (set in .env or on the CLI)"; exit 1; \
	fi
	uv run frida -U -f $(TARGET_BUNDLE_ID) -l $(FRIDA_OUT) --no-pause

# ---------------------------------------------------------------------------
# clang-format runner. Formats tracked ObjC / C sources under Sources/.
# vendor/ is skipped so 3rd-party source stays byte-identical to upstream.
# ---------------------------------------------------------------------------
.PHONY: format
format:
	find Sources -type f \( -name '*.h' -o -name '*.m' -o -name '*.mm' \
	  -o -name '*.c' -o -name '*.cpp' \) -exec clang-format -i {} +

.PHONY: format-check
format-check:
	find Sources -type f \( -name '*.h' -o -name '*.m' -o -name '*.mm' \
	  -o -name '*.c' -o -name '*.cpp' \) -exec clang-format --dry-run --Werror {} +

# ---------------------------------------------------------------------------
# Developer hooks. Point core.hooksPath at scripts/ so scripts/pre-commit
# fires before every commit. Idempotent.
# ---------------------------------------------------------------------------
.PHONY: hooks
hooks::
	git config core.hooksPath scripts
	@echo "git hooks now resolve under scripts/"
