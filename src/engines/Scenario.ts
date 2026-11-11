import { PlayerState, RallyResult, ballPositionAt, playerStateAt } from './rally';
import { Vec3 } from './vector';

type Listener = () => void;

/**
 * Playback controller over a precomputed rally: shared simulation clock,
 * play/pause/step/seek, playback rate and looping. Framework-free.
 */
export class Scenario {
  rally: RallyResult;
  time = 0;
  playing = false;
  rate = 1;
  loop = true;
  private listeners = new Set<Listener>();

  constructor(rally: RallyResult) {
    this.rally = rally;
  }

  get duration() {
    return this.rally.duration;
  }

  setRally(rally: RallyResult) {
    this.rally = rally;
    this.time = Math.min(this.time, rally.duration);
    this.emit();
  }

  play() {
    if (this.time >= this.duration) this.time = 0;
    this.playing = true;
    this.emit();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    this.time = Math.min(Math.max(t, 0), this.duration);
    this.emit();
  }

  /** Pauses and moves the clock by dt (negative steps backwards). */
  step(dt: number) {
    this.playing = false;
    this.seek(this.time + dt);
  }

  reset() {
    this.seek(0);
  }

  /** Advances the clock by a frame delta (seconds of wall time). */
  update(delta: number) {
    if (!this.playing) return;
    this.time += delta * this.rate;
    if (this.time >= this.duration) {
      if (this.loop) {
        this.time %= this.duration;
      } else {
        this.time = this.duration;
        this.playing = false;
        this.emit();
      }
    }
  }

  getBallPosition(): Vec3 {
    return ballPositionAt(this.rally, this.time);
  }

  getPlayerState(): PlayerState {
    return playerStateAt(this.rally, this.time);
  }

  /** Notified on discrete changes (play/pause, seek, new rally) — not every frame. */
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
