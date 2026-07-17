// Minimal Logos hook. Replace with the actual tweak logic.
// Logos syntax reference: https://theos.dev/docs/logos-syntax

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

%hook UIViewController

- (void)viewDidAppear:(BOOL)animated {
    %orig;
    NSLog(@"[App] viewDidAppear on %@", self);
}

%end

// Constructor called once when the tweak dylib is loaded into the target.
%ctor {
    NSLog(@"[App] tweak loaded");
}
