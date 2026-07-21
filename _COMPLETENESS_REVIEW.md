# Completeness Review: tetris

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned game engine, session/input/audio code, UI, tests, package scripts, and hosting configuration only; no dependency installation, build, browser run, performance trace, or deployment was performed.

## Classification

**Complete local scope**

This is a focused, complete local Tetris-style game. The engine implements a seeded seven-piece bag, movement/collision, SRS-style kicks, hold, ghost/hard drop, line clearing, scoring, levels, pause, and game-over state. Dedicated tests cover engine behavior, input repeat, audio, session state, and rendered output, and Cloudflare hosting metadata is present.

## Why it is not production-ready

- The test script builds and runs the Node test suite, but no checked-in CI workflow was found to run build, lint, and tests on supported Node/browser versions.
- Static tests do not prove frame pacing, keyboard repeat, focus/pause behavior, audio lifecycle, or responsive rendering across real browsers and devices.
- Accessibility needs explicit keyboard instructions, focus visibility, screen-reader status updates, color-contrast/non-color cues, reduced motion, and audio controls verified with users/tools.
- The release boundary is unclear: the package is private, and no LICENSE or browser-support/release policy was identified.
- The Cloudflare/vinext toolchain and required Node version need a pinned, tested deployment and rollback path.

## Needed features

1. Add CI that installs reproducibly and runs lint, production build, and all engine/session/input/audio/render tests on the supported Node version.
2. Add Playwright browser tests for start, movement, rotation, hold, pause/resume, game over, restart, keyboard focus loss, touch/mobile controls, and persisted settings.
3. Complete accessibility hardening with remappable controls, visible focus, non-color piece/status cues, live score/state announcements, reduced-motion mode, and independent mute/volume controls.
4. Profile and cap render/input latency on low-end mobile and desktop browsers; test tab suspension, resize/orientation, high refresh rate, and long-session memory behavior.
5. Define release metadata: license/attribution, supported browsers/devices, semantic versioning, privacy stance, error monitoring, Cloudflare preview promotion, and rollback.

## Risks or launch blockers

- Browser-specific input timing or focus bugs can make an otherwise correct engine unplayable.
- Accessibility regressions are not covered by the current Node-level suite.
- The hosting toolchain targets recent Node/vinext/Workers versions and needs a verified reproducible deploy before public release.
- Missing license/release policy creates distribution and maintenance uncertainty.

## Evidence inspected

- `package.json:8`
- `app/game/engine.ts:1`
- `tests/engine.test.mjs:20`
- `tests/input-repeat.test.mjs`
- `tests/session.test.mjs`
- `.openai/hosting.json`

## Recommended next action

Add CI and a small Playwright matrix around real keyboard/touch/focus behavior, then perform accessibility and performance QA on the Cloudflare preview before publishing a versioned release.

## Implementation progress (2026-07-20)

- Added reproducible Node 22 CI gates for install, lint, type checking, production build, 22 engine/session/input/audio/control/render tests, production dependency audit, and retained Playwright failure artifacts.
- Added a 20-case Playwright matrix for Chromium, Firefox, WebKit, and Pixel 7 emulation. The 13 applicable paths pass and cover start, movement, rotation, hold, pause/resume, game over/restart, focus release, touch, resize/orientation, settings persistence, tab suspension, reduced motion, and four-times CPU-throttled input/frame budgets; seven project-specific cases are intentionally skipped.
- Added validated, persistent key remapping; independent mute and effects volume; focus-safe help controls; live state announcements; host-loss pause/release handling; visible focus; reduced motion; and distinct per-piece texture cues that do not rely on color alone.
- Defined the v1.1.0 release boundary with MIT licensing, trademark/font attribution, supported browsers/devices, semantic versioning, privacy and monitoring limits, performance budgets, Cloudflare preview promotion, and rollback procedures.
- Generated and inspected one 1200×630 Blockline social card, saved it as `public/og.png`, and added incoming-host-derived canonical, Open Graph, and Twitter metadata.
- Verified a clean `npm ci`, `npm run check`, full Playwright matrix, high-severity production audit gate, and a production-server smoke test. npm reports two moderate PostCSS advisories nested in Next with no non-breaking remediation; no high-severity production advisory remains.

## Runtime verification (2026-07-20)

- Added a safe production `start.sh` that honors caller-assigned loopback host and port, requires installed dependencies and a prebuilt production bundle, and performs no build or mutation at startup.
- This local game has no account or login surface. Its primary gameplay journey is covered by the recorded cross-browser Playwright matrix and production smoke evidence above.
