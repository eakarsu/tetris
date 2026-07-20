# Release policy

## Versioning and support

Blockline follows semantic versioning. Fixes increment the patch version, backward-compatible gameplay or interface features increment the minor version, and incompatible preference/storage or rules changes increment the major version. Release tags use `vMAJOR.MINOR.PATCH` and must point to the exact commit promoted to production.

The supported production matrix is:

- Node.js 22.13 or newer within the Node 22 LTS line for builds and deployment.
- Current and previous two stable releases of Chrome/Edge, Firefox, and Safari on desktop.
- Current and previous two major releases of iOS Safari and Android Chrome on touch devices at least 360 CSS pixels wide.
- Keyboard, pointer, and touch input; portrait and landscape layouts; 60–144 Hz displays; system reduced-motion mode.

Older browsers may work but are not release blockers. A dependency or browser-support change requires updating the CI matrix and this policy in the same pull request.

## Quality and performance gates

Every pull request must pass `npm ci`, lint, TypeScript, the production build, Node tests, production dependency audit, and the Playwright matrix. CI uses the Node version declared in the workflow and retains browser traces on failure.

On a four-times CPU-throttled Chromium desktop profile, observed keyboard-to-state latency must remain below 250 ms, p95 animation-frame time below 80 ms, and the worst sampled frame below 250 ms. Releases also exercise tab suspension, focus loss, responsive resize/orientation, reduced motion, and repeated play/restart cycles. These are conservative automated caps; regressions visible on representative low-end physical Android and iOS devices still block promotion.

## Privacy and monitoring

Blockline has no accounts, analytics, advertising, cookies, or gameplay telemetry. Personal best, mute state, effects volume, and key bindings stay in browser `localStorage` under `blockline:tetris:v1`; clearing site data removes them. No game state or key presses are sent to a server.

Cloudflare may retain aggregate request and runtime error logs under the hosting account's configured retention policy. Logs must not add gameplay state, control bindings, IP-derived profiles, or other user identifiers. Maintainers review error counts and deployment health after promotion; adding client monitoring requires a separate privacy review and this policy must be updated before collection begins.

## Preview, promotion, and rollback

1. Merge only after CI is green and the lockfile is unchanged from the validated build.
2. Create a private Cloudflare preview from the release commit and record its deployment/version identifier in the release notes.
3. Smoke-test start, keyboard and touch input, pause/resume, help focus, settings persistence, and a completed run on the preview.
4. Tag the validated commit and promote that exact version; never rebuild from a different working tree.
5. Verify the production title, social card, game start, and runtime logs immediately after promotion.

If a launch blocker appears, redeploy the last known-good Cloudflare version from deployment history, verify its health, and then revert the offending commit on `main`. Do not delete the failed version until the incident has been understood. A rollback is complete only when the public route, smoke checks, and error rate have returned to the prior baseline.
