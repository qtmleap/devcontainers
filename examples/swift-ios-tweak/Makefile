# Theos build entry point.
# Reference: https://theos.dev/docs/logos-syntax
TARGET := iphone:clang:16.5:14.0
ARCHS = arm64

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = App
App_FILES = Tweak.x
App_CFLAGS = -fobjc-arc

include $(THEOS_MAKE_PATH)/tweak.mk
