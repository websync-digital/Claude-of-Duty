/**
 * TimeManager.js
 * Controls temporal flow, bullet-time dilation, rewind state transitions, and rewind gauges.
 */

export class TimeManager {
  constructor(soundEffects) {
    this.sfx = soundEffects;
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;

    // Bullet-Time state
    this.bulletTimeActive = false;
    this.bulletTimeEnergy = 100;
    this.maxBulletTimeEnergy = 100;

    // Rewind state
    this.rewindActive = false;
    this.rewindEnergy = 100;
    this.maxRewindEnergy = 100;
    this.rewindStepSpeed = 3; // Number of snapshot frames to rewind per 50Hz tick
    this.currentRewindStep = 0;

    // Warp intensity for shaders (0.0 to 1.0)
    this.warpIntensity = 0.0;
    this.chromaticAberration = 0.0;
  }

  toggleBulletTime() {
    if (this.rewindActive) return;
    if (!this.bulletTimeActive && this.bulletTimeEnergy < 15) return;

    this.bulletTimeActive = !this.bulletTimeActive;
    this.targetTimeScale = this.bulletTimeActive ? 0.25 : 1.0;
    this.sfx.playBulletTimeToggle(this.bulletTimeActive);
  }

  startRewind() {
    if (this.rewindActive || this.rewindEnergy < 20) return false;
    this.rewindActive = true;
    this.bulletTimeActive = false;
    this.currentRewindStep = 0;
    this.sfx.playRewindLoop(true);
    return true;
  }

  stopRewind() {
    if (!this.rewindActive) return;
    this.rewindActive = false;
    this.targetTimeScale = 1.0;
    this.timeScale = 1.0;
    this.sfx.playRewindLoop(false);
  }

  update(dt) {
    // Smooth timeScale interpolation
    this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1.0, dt * 10);

    // Bullet Time energy management
    if (this.bulletTimeActive) {
      this.bulletTimeEnergy -= dt * 25;
      this.warpIntensity = Math.min(1.0, this.warpIntensity + dt * 4);
      this.chromaticAberration = 0.4;
      if (this.bulletTimeEnergy <= 0) {
        this.bulletTimeEnergy = 0;
        this.toggleBulletTime();
      }
    } else {
      this.bulletTimeEnergy = Math.min(this.maxBulletTimeEnergy, this.bulletTimeEnergy + dt * 12);
      if (!this.rewindActive) {
        this.warpIntensity = Math.max(0.0, this.warpIntensity - dt * 5);
        this.chromaticAberration = Math.max(0.0, this.chromaticAberration - dt * 3);
      }
    }

    // Rewind energy management
    if (this.rewindActive) {
      this.rewindEnergy -= dt * 35;
      this.currentRewindStep += this.rewindStepSpeed;
      this.warpIntensity = 1.0;
      this.chromaticAberration = 1.0;
      if (this.rewindEnergy <= 0) {
        this.rewindEnergy = 0;
        this.stopRewind();
      }
    } else {
      this.rewindEnergy = Math.min(this.maxRewindEnergy, this.rewindEnergy + dt * 10);
    }
  }

  reset() {
    this.bulletTimeActive = false;
    this.rewindActive = false;
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
    this.bulletTimeEnergy = 100;
    this.rewindEnergy = 100;
    this.warpIntensity = 0;
    this.chromaticAberration = 0;
    this.sfx.playRewindLoop(false);
  }
}
