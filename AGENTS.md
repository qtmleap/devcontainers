# Shared development routine

Portable development preferences for projects using these templates. Preserve
project-specific instructions and existing managed policy blocks when adopting.

<!-- development-orchestration -->
## Parallel development and verification across projects

- Apply these preferences across projects and execution hosts. Discover the
  target repository's commands, CI coverage, required gates, and available
  skills/tools; never assume another host's installation or access applies.
- Split useful independent work among workers, including frontend and backend
  implementation. Agree API schemas, authentication, error behavior, and shared
  file ownership first. Use separate worktrees or non-overlapping file ownership;
  coordinate contract changes and verify integration against the real backend.
- Run long tests/builds asynchronously and retain their job IDs. While they run,
  continue authorized work that does not depend on their outcome. Wait when no
  useful independent work remains; do not start unrelated work to fill time.
- Keep each verification run tied to immutable source content, including relevant
  uncommitted files, dependencies, toolchain, target, and configuration. Isolate
  its worktree/copy, writable build caches, simulator, ports, and result paths from
  ongoing development. Reviews and tests may overlap on the same snapshot.
- During iteration, prefer fast checks for changed behavior, failure reproduction,
  and checks CI cannot perform. Let CI run its required full suites; inspect the
  actual workflow before assigning a check to CI. Preserve mandatory local hooks,
  repository checks, and release gates. Add broader coverage where the change's
  risk requires it rather than running every device/OS/locale/theme combination
  after every edit.
- Avoid repeating successful equivalent checks without a concrete reason, such
  as changed inputs, failure investigation, unresolved risk, or a mandatory gate.
  Reuse evidence only when its scope and environment still match. Pending, stale,
  skipped, interrupted, and unknown results are not passes. After integration or
  fixes, revalidate affected behavior on the resulting content.
- Track job outcomes and owned resources. Inspect existing jobs after timeouts
  before retrying; clean up only resources owned by the run after workers finish
  or are confirmed stopped. Cap heavy parallel jobs to avoid resource contention.
  Keep small changes lightweight and follow the existing review policy.

## UI design, previews, and store screenshots

- For new screens or substantial flow changes, use an available UI design and
  interactive prototyping capability, such as Product Design, to explore screens,
  navigation, and error/empty/loading states before implementation. Reuse the
  existing design system. Small UI fixes do not require a new prototype.
- Web mocks and previews default to Tailscale-only access. Discover the actual
  host's Tailscale IP or MagicDNS name and available port. Bind to the intended
  Tailscale interface, or use loopback behind Tailscale Serve; do not enable public
  Funnel or public hosting without explicit authorization.
- Provide the actual reachable preview URL. Verify access through the intended
  tailnet client path, including API URLs and WebSocket/HMR when applicable;
  localhost success alone does not prove remote access. Report any client-side
  reachability that could not be verified. Preserve existing services and ports.
- Distinguish mock data from real backend integration. A web prototype does not
  replace required native simulator/device UI verification.
- For App Store marketing screenshots, use the app-store-screenshots skill from
  https://github.com/ParthJadhav/app-store-screenshots. Locate and read the skill on
  the execution host; reuse an existing installation and editor project. If the
  capability is missing, report it and follow the appropriate installation flow.
- Reuse suitable captures from the verified app revision; recapture affected
  screens/device/locale/theme conditions when they change. Use the editor for
  localized copy, device frames, layout, and export; visually check exported
  images and current store requirements. Apply the Tailscale preview policy even
  when a skill's example uses localhost. Run this workflow when store assets are
  requested or needed for the authorized release, not after every code edit.

## App Store Connect tools and authentication

- Discover and prefer ASC MCP for supported App Store Connect operations before
  choosing browser automation or requesting an Apple ID browser login. Use the
  existing API-key/native fastlane route for packaging and upload where applicable;
  signing/provisioning assets and web sessions remain separate dependencies.
- Do not request browser authentication merely because a task involves Apple or
  because a request failed. Distinguish missing capability, API authentication,
  permissions, and transient errors. Request interactive login only when the
  necessary operation demonstrably requires it, explain the specific blocker,
  and continue work that is independent of that blocker.
- Keep upload acceptance, Apple processing completion, tester availability, and
  App Review/release state distinct. Inspect operation status after an uncertain
  upload or write instead of blindly resending it.
<!-- /development-orchestration -->
