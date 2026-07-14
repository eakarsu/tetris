# Blockline Tetris

Blockline is a responsive, tournament-inspired Tetris game built with React, Next.js, and Vinext. It includes a deterministic seven-bag engine, guideline-style wall kicks, hold and preview queues, ghost pieces, lock delay, scoring streaks, sound effects, and a dedicated mobile control layout.

## Play locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000` on the development machine. A phone on the same Wi-Fi network can use the machine's LAN address with port `3000`.

## Controls

| Action | Keyboard | Mobile |
| --- | --- | --- |
| Move | Left / Right arrows | Left / Right buttons |
| Soft drop | Down arrow | Down button |
| Rotate clockwise | Up arrow or X | Rotate button |
| Rotate counter-clockwise | Z | — |
| Hard drop | Space | Drop button |
| Hold | C or Shift | Hold button |
| Pause | P or Escape | Header Pause button |
| Sound | M | Header SFX button |

Keyboard movement uses owned DAS/ARR timing for consistent behavior across computers. Mobile controls are pointer-first, support simultaneous movement and soft drop, and automatically release when the page loses focus.

## Quality checks

```bash
npm test
npm run lint
npx tsc --noEmit
```

The test suite covers deterministic bags, collision and wall-kick behavior, ghost and hard drops, hold rules, line clearing, scoring, piece telemetry, pause transitions, time/rate formatting, and server-rendered deployment output.

## Project structure

- `app/game/engine.ts` — board state, pieces, movement, rotation, scoring, and progression
- `app/game/session.ts` — run-clock and piece-rate formatting
- `app/page.tsx` — game loop, input system, audio, persistence, and interface
- `app/globals.css` — desktop, phone, and landscape presentation
- `tests/` — engine and deployment regression coverage
