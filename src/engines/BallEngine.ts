import * as THREE from 'three';

export interface BallParams {
  bouncePoint: { x: number; z: number };
  initialSpeed: number;
  startPos: THREE.Vector3;
  gravity: number;
  restitution: number;
}

export class BallEngine {
  params: BallParams;
  trajectory: THREE.Vector3[] = [];
  times: number[] = [];
  contactTime = 0;
  playerPos = new THREE.Vector3(0, 1, -10);

  constructor(params: BallParams) {
    this.params = { ...params };
    this.recalculate();
  }

  updateParams(newParams: Partial<BallParams>) {
    this.params = { ...this.params, ...newParams };
    this.recalculate();
  }

  recalculate() {
    this.trajectory = [];
    this.times = [];
    const dt = 0.016;
    let t = 0;
    let pos = this.params.startPos.clone();
    let vel = this.computeInitialVel();

    const maxT = 5;
    while (t < maxT && pos.z > -12) {
      this.trajectory.push(pos.clone());
      this.times.push(t);

      vel.y -= this.params.gravity * dt;
      pos.add(vel.clone().multiplyScalar(dt));

      if (pos.y <= 0 && vel.y < 0) {
        pos.y = 0;
        vel.y *= -this.params.restitution;
      }

      if (pos.distanceTo(this.playerPos) < 0.5 && this.contactTime === 0) {
        this.contactTime = t;
      }

      t += dt;
    }
    if (this.contactTime === 0) this.contactTime = t * 0.7;
  }

  private computeInitialVel(): THREE.Vector3 {
    // Approximate to hit bounce then player
    const toBounce = new THREE.Vector3(this.params.bouncePoint.x, 0, this.params.bouncePoint.z).sub(this.params.startPos);
    const dir = toBounce.normalize();
    const speed = this.params.initialSpeed;
    return dir.multiplyScalar(speed).setY(4); // some lift
  }

  getPosition(simTime: number): THREE.Vector3 {
    if (this.trajectory.length === 0) return this.params.startPos;
    let i = 0;
    while (i < this.times.length - 1 && this.times[i + 1] < simTime) i++;
    if (i >= this.trajectory.length - 1) return this.trajectory[this.trajectory.length - 1];
    const alpha = (simTime - this.times[i]) / (this.times[i + 1] - this.times[i] || 1);
    return this.trajectory[i].clone().lerp(this.trajectory[i + 1], Math.min(1, alpha));
  }

  getContactTime() { return this.contactTime; }
}
