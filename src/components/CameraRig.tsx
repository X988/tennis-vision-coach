import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EYE_HEIGHT } from '../engines/strokes';
import { Scenario } from '../engines/Scenario';
import { CameraPreset } from './uiConstants';

const VIEWS: Partial<Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }>> = {
  broadcast: { pos: [0, 9, -27], target: [0, 0, 0] },
  side: { pos: [17, 5, -4], target: [0, 1, -4] },
  top: { pos: [0, 32, 0.01], target: [0, 0, 0] },
};

interface ControlsLike {
  target: { set: (x: number, y: number, z: number) => void };
  enabled: boolean;
  update: () => void;
}

/** Presets that follow the player every frame (orbit controls are disabled). */
const TRACKING: CameraPreset[] = ['behind', 'eyes'];

/**
 * Moves the camera to fixed presets. "Behind" follows the player over the
 * shoulder; "player's eyes" looks at the ball from the player's head.
 */
export function CameraRig({ preset, scenario }: { preset: CameraPreset; scenario: Scenario }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;

  useEffect(() => {
    if (!controls) return;
    controls.enabled = !TRACKING.includes(preset);
    const view = VIEWS[preset];
    if (view) {
      camera.position.set(...view.pos);
      controls.target.set(...view.target);
      controls.update();
    }
  }, [preset, camera, controls]);

  useFrame(() => {
    if (!TRACKING.includes(preset)) return;
    const { position } = scenario.getPlayerState();
    if (preset === 'behind') {
      camera.position.set(position.x * 0.7, 2.8, position.z - 5.5);
      camera.lookAt(position.x * 0.3, 1, 0);
      return;
    }
    const ball = scenario.getBallPosition();
    // Slightly in front of the face so the player's own head is not in view.
    camera.position.set(position.x, EYE_HEIGHT, position.z + 0.15);
    camera.lookAt(ball.x, ball.y, ball.z);
  });

  return null;
}
