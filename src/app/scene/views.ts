import * as THREE from 'three';
import { PLAYER_FORWARD } from '../../engines/court';
import { Plan } from '../../engines/plan';
import type { CameraView } from '../store';

/** Camera position and look-at target for a named view of a plan. */
export function viewFor(plan: Plan, view: CameraView): { pos: THREE.Vector3; target: THREE.Vector3 } | null {
  const h = plan.hit;
  const c = plan.contact.pos;
  const s = plan.motion.side;
  switch (view) {
    case 'top':
      return { pos: new THREE.Vector3(0, 30, -3.5), target: new THREE.Vector3(0, 0, -3.5) };
    case 'side': {
      const sx = h.x <= 0 ? -1 : 1;
      return { pos: new THREE.Vector3(h.x + sx * 9, 2.4, h.z + 1.5), target: new THREE.Vector3(h.x, 0.9, h.z + 1.5) };
    }
    case 'back':
      return { pos: new THREE.Vector3(h.x * 0.6, 2.7, h.z - 6), target: new THREE.Vector3(h.x * 0.3, 1, h.z + 6) };
    case 'opponent':
      return { pos: new THREE.Vector3(0, 4.5, 14), target: new THREE.Vector3(h.x, 1, h.z) };
    case 'contact': {
      const dir = new THREE.Vector3(PLAYER_FORWARD.x + s.x * 0.7, 0.25, PLAYER_FORWARD.z + s.z * 0.7).normalize();
      return { pos: new THREE.Vector3(c.x, c.y, c.z).addScaledVector(dir, 3), target: new THREE.Vector3(c.x, c.y - 0.1, c.z - 0.3) };
    }
    default:
      return null;
  }
}

