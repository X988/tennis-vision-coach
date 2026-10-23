# Tennis Vision Coach

Vertical slice: right forehand scenario with Ball Engine (approximate physics + bounce), AnimationEngine (sync contact), Scenario.

## Architecture
- `src/engines/BallEngine.ts` — trajectory, bounce, contact time
- `src/engines/AnimationEngine.ts` — forehand progress scaled to contact
- `src/engines/Scenario.ts` — shared simTime, params, play/pause
- Components: Court (singles dimensions), Ball, Player (placeholder; drop glTF into public/models/)

## Launch
```bash
git clone https://github.com/X988/tennis-vision-coach.git
cd tennis-vision-coach
npm install
npm run dev
```
Open http://localhost:5173

Controls: Play/Pause/Step, speed 0.25x/1x, camera presets + free orbit, sliders for bounce Z and ball speed (recalculates trajectory + contact sync).

Target ≥30 FPS on mid-range hardware (simple geometry).

Replace Player with `useGLTF` for real model.
