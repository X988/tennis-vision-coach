# Tennis Vision Coach

3D trainer for reading the ball and timing a stroke: the opponent's shot is
simulated with real ball aerodynamics, the player moves to the ball and the
swing is synchronised so the racket meets the ball exactly at contact.

Built with React, three.js and react-three-fiber.

## Launch

```bash
git clone https://github.com/X988/tennis-vision-coach.git
cd tennis-vision-coach
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Ball physics** — gravity, quadratic air drag and Magnus lift from spin (RK4
  integration); bounce with restitution and friction that changes speed and
  spin (topspin kicks, slice skids). Hard, clay and grass surfaces.
- **Shot solver** — for a given speed and spin, finds the launch angle that
  lands the ball on the chosen target; reports net clearance, in/out and
  unreachable targets.
- **Scenarios** — forehand topspin, one-handed backhand, backhand slice and
  serve return. Every parameter can be tuned: incoming and reply speed, spin,
  target, contact depth, stroke and surface.
- **Synchronised player** — the player runs to the hitting position and the
  swing phase is derived from the contact time, so contact is exact at any
  playback speed, when stepping or scrubbing.
- **Views** — TV, over-the-shoulder, side, top, the player's eyes (tracks the
  ball) and free orbit. Trajectory lines, bounce marks (red = out) and the
  contact point.
- **Analysis panel** — time to contact, contact height and depth, launch
  angle, net clearance, speed before/after the bounce, vertical rebound.

### Controls

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Step one frame (1/30 s) back / forward |
| `C` | Jump to contact |
| `R` | Reset to start |
| `+` / `-` | Playback speed (0.1× – 1×) |
| `1`–`6` | Cameras: TV, Behind, Side, Top, Player's eyes, Free |

## Architecture

Simulation code in `src/engines` is framework-free and unit tested:

| File | Responsibility |
| --- | --- |
| `vector.ts` | Small immutable vector math helpers |
| `physics.ts` | Constants, court surfaces, flight integration, bounce model, launch solver |
| `strokes.ts` | Stroke definitions (keyframed poses), racket kinematics, swing timing |
| `rally.ts` | Scenario config and presets; computes incoming shot → contact → reply, player placement |
| `Scenario.ts` | Playback clock: play / pause / step / seek, rate, loop, subscriptions |

The whole rally is precomputed when parameters change, so playback is a pure
function of time — deterministic and independent of frame rate.

React components (`src/components`) only render the state: `Court`, `Ball`
(with contact shadow), `Player`, `TrajectoryOverlay`, `CameraRig`,
`SimDriver` (advances the clock each frame) and the HTML UI in
`src/components/ui`.

The player is built from primitives whose geometry matches `strokes.ts`. To use
a rigged glTF model, load it with `useGLTF` and drive its bones with the same
`Pose` (torso yaw, arm yaw, arm pitch).

Coordinates: metres; `x` across the court, `y` up, `z` along the court with the
net at `z = 0`. The coached player is on the `-z` side, facing `+z`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting |
| `npm run check` | Type-check + lint + tests |

CI (GitHub Actions) runs type-check, lint, tests and build on every push to
`main` and on pull requests.
