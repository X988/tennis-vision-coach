import { Phase, TimelineEvent } from './plan';

type Listener = () => void;

export const RATES = [0.1, 0.25, 0.5, 1, 2] as const;
export const FRAME = 1 / 30;

/**
 * The shared simulationTime. Ball, player, racket, overlays and the timeline
 * all read this one clock, so they can never drift apart.
 */
export class SimulationClock {
  time = 0;
  duration: number;
  playing = false;
  rate = 1;
  loop = false;
  private listeners = new Set<Listener>();

  constructor(duration: number) {
    this.duration = duration;
  }

  setDuration(d: number) {
    this.duration = d;
    this.time = Math.min(this.time, d);
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

  step(dt: number) {
    this.playing = false;
    this.seek(this.time + dt);
  }

  /** Jump to the next / previous phase or event boundary. */
  jump(marks: (Phase | TimelineEvent)[], dir: 1 | -1) {
    const times = [...new Set(marks.map((m) => ('start' in m ? m.start : m.t)))].sort((a, b) => a - b);
    const eps = 1e-3;
    const target = dir > 0 ? times.find((t) => t > this.time + eps) : [...times].reverse().find((t) => t < this.time - eps);
    this.step((target ?? (dir > 0 ? this.duration : 0)) - this.time);
  }

  update(delta: number) {
    if (!this.playing) return;
    this.time += delta * this.rate;
    if (this.time >= this.duration) {
      if (this.loop) this.time %= this.duration;
      else {
        this.time = this.duration;
        this.playing = false;
        this.emit();
      }
    }
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
