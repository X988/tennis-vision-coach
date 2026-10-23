import { BallEngine, BallParams } from './BallEngine';
import { AnimationEngine } from './AnimationEngine';
import * as THREE from 'three';

export class Scenario {
  ballEngine: BallEngine;
  animEngine: AnimationEngine;
  simTime = 0;
  speed = 1;
  playing = false;

  constructor() {
    const params: BallParams = {
      bouncePoint: { x: 2.5, z: -8 },
      initialSpeed: 15,
      startPos: new THREE.Vector3(0, 2.5, 8),
      gravity: 9.81,
      restitution: 0.75,
    };
    this.ballEngine = new BallEngine(params);
    this.animEngine = new AnimationEngine();
    this.sync();
  }

  sync() {
    const ct = this.ballEngine.getContactTime();
    this.animEngine.setContactTime(ct);
  }

  setBouncePoint(x: number, z: number) {
    this.ballEngine.updateParams({ bouncePoint: { x, z } });
    this.sync();
    this.reset();
  }

  setSpeed(s: number) {
    this.ballEngine.updateParams({ initialSpeed: s });
    this.sync();
    this.reset();
  }

  play() { this.playing = true; this.animEngine.playing = true; }
  pause() { this.playing = false; this.animEngine.playing = false; }
  step(dt = 0.016) {
    this.update(dt);
  }
  reset() {
    this.simTime = 0;
    this.animEngine.reset();
  }

  update(delta: number) {
    if (!this.playing) return;
    this.simTime += delta * this.speed;
    this.animEngine.update(delta * this.speed, this.simTime);
  }

  getBallPos() { return this.ballEngine.getPosition(this.simTime); }
  getAnimProgress() { return this.animEngine.getProgress(); }
}
