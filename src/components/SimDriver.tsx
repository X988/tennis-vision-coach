import { useFrame } from '@react-three/fiber';
import { Scenario } from '../engines/Scenario';

/** Advances the shared simulation clock once per rendered frame. */
export function SimDriver({ scenario }: { scenario: Scenario }) {
  // Clamp the delta so a background tab does not make the ball jump.
  useFrame((_, delta) => scenario.update(Math.min(delta, 0.1)));
  return null;
}
