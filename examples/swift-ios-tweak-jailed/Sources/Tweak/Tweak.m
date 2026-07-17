#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// fishhook — rebinds imported C symbols in __DATA{,_CONST}. Two files,
// no external deps. Header-only-ish drop-in at vendor/fishhook/.
#import "fishhook.h"

// Hook engine: substrate on JB, Dobby (statically linked) on jailed.
#if IPA_JAILED
#import "dobby.h"
#define HookFunction(sym, repl, orig) \
    ((void)DobbyHook((void *)(sym), (void *)(repl), (void **)(orig)))
#else
#import <substrate.h>
#define HookFunction(sym, repl, orig) \
    MSHookFunction((sym), (repl), (orig))
#endif

// ===========================================================================
// Template constructor. Fill in per-site HookFunction() calls (or fishhook
// rebindings, or ObjC runtime swizzles) below to build the real tweak.
// ===========================================================================

#ifndef TWEAK_COMMIT
#define TWEAK_COMMIT "unknown"
#endif
#ifndef TWEAK_VERSION
#define TWEAK_VERSION "dev"
#endif

__attribute__((constructor)) static void init(void) {
    NSLog(@"=== tweak %s (%s) loaded ===", TWEAK_VERSION, TWEAK_COMMIT);
}
