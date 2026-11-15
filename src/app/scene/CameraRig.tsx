import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Plan } from '../../engines/plan';
import { CameraView } from '../store';
import { viewFor } from './views';

interface ControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

/** Smoothly flies the camera to the selected view; orbit controls stay active in every view. */
export function CameraRig({ plan, view }: { plan: Plan; view: CameraView }) {
  const camera = useThree((st) => st.camera);
  const controls = useThree((st) => st.controls) as unknown as ControlsLike | null;
  const goal = useMemo(() => viewFor(plan, view), [plan, view]);
  const anim = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!goal || !controls) return;
    anim.current = { t: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone() };
  }, [goal, camera, controls]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !goal || !controls) return;
    a.t = Math.min(1, a.t + delta / 0.6);
    const e = a.t * a.t * (3 - 2 * a.t);
    camera.position.lerpVectors(a.fromPos, goal.pos, e);
    controls.target.lerpVectors(a.fromTarget, goal.target, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });

  return null;
}
