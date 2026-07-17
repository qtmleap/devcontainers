// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "app",
    targets: [
        .executableTarget(name: "app"),
        .testTarget(name: "appTests", dependencies: ["app"]),
    ]
)
