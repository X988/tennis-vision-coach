export class AnimationEngine {
  duration = 1.5; // base animation length
  contactRatio = 0.6; // contact at 60% of animation
  speed = 1;
  currentTime = 0;
  playing = false;

  setContactTime(contactTime: number) {
    // Scale so that contact happens at contactTime
    this.speed = (this.duration * this.contactRatio) / Math.max(contactTime, 0.1);
  }

  update(delta: number, simTime: number) {
    if (!this.playing) return;
    this.currentTime += delta * this.speed;
    if (this.currentTime > this.duration) this.currentTime = 0;
  }

  getProgress(): number {
    return (this.currentTime % this.duration) / this.duration;
  }

  isContact(): boolean {
    const prog = this.getProgress();
    return Math.abs(prog - this.contactRatio) < 0.05;
  }

  reset() { this.currentTime = 0; }
}
