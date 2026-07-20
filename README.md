# Blockline Tetris

Blockline is a responsive, tournament-inspired Tetris game built with React, Next.js, and Vinext. It includes a deterministic seven-bag engine, guideline-style wall kicks, hold and preview queues, ghost pieces, lock delay, scoring streaks, sound effects, and a dedicated mobile control layout.

## Play locally

Node.js 22.13 or newer is required. Use the checked-in lockfile for a reproducible install.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` on the development machine. A phone on the same Wi-Fi network can use the machine's LAN address with port `3000`.

## Controls

| Action | Keyboard | Mobile |
| --- | --- | --- |
| Move | Left / Right arrows | Left / Right buttons |
| Soft drop | Down arrow | Down button |
| Rotate clockwise | Up arrow | Rotate button |
| Rotate counter-clockwise | Z | — |
| Hard drop | Space | Drop button |
| Hold | C | Hold button |
| Pause | P or Escape | Header Pause button |
| Sound | M | Header SFX button |

Keyboard movement uses owned DAS/ARR timing for consistent behavior across computers. Mobile controls are pointer-first, support simultaneous movement and soft drop, and automatically release when the page loses focus.

Open the field manual with the `?` button to remap any keyboard action, adjust effects volume independently, or mute effects. Preferences and the personal best are stored only in the current browser.

On mobile, tapping **Play Now** unlocks the browser audio engine and starts an audible countdown. Turning SFX back on also plays a confirmation cue.

## Quality checks

```bash
npm test
npm run lint
npm run typecheck
npm run test:e2e
```

The Node suite covers deterministic bags, collision and wall-kick behavior, ghost and hard drops, hold rules, line clearing, scoring, piece telemetry, pause transitions, preferences, time/rate formatting, and server-rendered deployment output. Playwright covers Chromium, Firefox, WebKit, and an emulated Pixel 7 across keyboard, touch, focus loss, suspension, orientation, persistence, reduced motion, and throttled performance paths.

## Accessibility

The playfield exposes a descriptive state label and live announcements for countdown, clears, levels, pause, and game over. Every piece has a distinct pattern as well as color, all controls have visible keyboard focus, the help dialog traps and restores focus, and operating-system reduced-motion preferences remove animated timing. Gameplay remains fully usable with effects muted or volume set to zero.

## Release and privacy

Blockline uses semantic versioning. The supported runtime/browser matrix, performance budgets, preview promotion, rollback procedure, privacy stance, and monitoring boundary are defined in [RELEASE.md](./RELEASE.md). Security reports should follow [SECURITY.md](./SECURITY.md). Source code is available under the MIT License; see [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).

## Project structure

- `app/game/engine.ts` — board state, pieces, movement, rotation, scoring, and progression
- `app/game/session.ts` — run-clock and piece-rate formatting
- `app/game/controls.ts` — validated, persistent control remapping and volume bounds
- `app/page.tsx` — game loop, input system, audio, persistence, and interface
- `app/globals.css` — desktop, phone, and landscape presentation
- `tests/` — engine and deployment regression coverage
- `e2e/` — cross-browser keyboard, touch, accessibility, and performance coverage
