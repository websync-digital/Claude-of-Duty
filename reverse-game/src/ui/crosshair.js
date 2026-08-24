import { el, setStyle, clamp, clamp01, damp, ease } from './util.js';

/**
 * Dynamic four-blade reticle.
 *
 * Spread model (all in HUD pixels at k=1):
 *   gap = base + move*MOVE + fire kick + flinch
 * The kick is a spring so a burst punches the blades out and they settle back
 * with a little overshoot instead of linearly interpolating — that overshoot is
 * most of what makes firing feel mechanical rather than animated.
 *
 * ADS hides the whole reticle over 70ms (the optic reticle is the weapon's job).
 */
export class Crosshair {
  constructor(parent) {
    this.root = el('div', 'ow-cross', parent);
    this.blades = new Array(4);
    for (let i = 0; i < 4; i++) this.blades[i] = el('div', 'ow-blade', this.root);
    this.dot = el('div', 'ow-dot', this.root);

    this.k = 1;
    this.gap = 4;
    this.kick = 0;
    this.kickVel = 0;
    this.moveSpread = 0;
    this.adsBlend = 0;
    this.hitPulse = 0;
    this.hitColor = 0;  // 0=white, 1=red flash
    this.visible = 1;

    // preallocated transform scratch — string concat only, no objects
    this._rot = [0, 90, 180, 270];
  }

  /** Called on every shot. `amount` scales with weapon recoil. */
  onFire(amount = 1) {
    this.kickVel += 60 * amount;
    this.kick = Math.min(this.kick + 0.9 * amount, 12);
  }

  /** Taking damage nudges the reticle — reads as flinch. */
  onFlinch(amount = 1) {
    this.kickVel += 22 * amount;
  }

  onHit(kind = 'hit') {
    this.hitPulse = 1;
    this.hitColor = kind === 'kill' ? 2 : kind === 'head' ? 1.5 : 1;
  }

  /**
   * @param {object} s { move:0..1, sprint:bool, ads:bool, crouch:bool,
   *                     baseSpread:px, hidden:bool }
   */
  update(dt, s) {
    // --- spring kick -------------------------------------------------------
    const stiff = 150;
    const dampC = 15;
    this.kickVel += (0 - this.kick) * stiff * dt - this.kickVel * dampC * dt;
    this.kick += this.kickVel * dt;
    if (this.kick < 0) {
      this.kick = 0;
      if (this.kickVel < 0) this.kickVel *= 0.4;
    }

    // --- movement / stance bloom ------------------------------------------
    const target =
      (s.move ?? 0) * 7 + (s.sprint ? 6 : 0) - (s.crouch ? 1.6 : 0) + (s.airborne ? 5 : 0);
    this.moveSpread = damp(this.moveSpread, target, 9, dt);

    this.adsBlend = damp(this.adsBlend, s.ads ? 1 : 0, 16, dt);
    this.hitPulse = Math.max(0, this.hitPulse - dt * 7);
    this.hitColor = Math.max(0, this.hitColor - dt * 7);

    const base = (s.baseSpread ?? 4) - this.adsBlend * 2;
    const gap = (base + this.moveSpread + this.kick) * this.k;
    // blades grow a touch as they spread — keeps the mass of the reticle even
    const len = clamp(1 + this.moveSpread * 0.035 + this.kick * 0.04, 1, 1.5);

    const fade = clamp01(1 - this.adsBlend * 1.25) * (s.hidden ? 0 : 1);
    this.visible = damp(this.visible, fade, 22, dt);
    const vis = this.visible;

    // CoD-style: blades flash a slight red-orange tint on hit, then return white
    const hitR = clamp01(this.hitColor);
    const br = 255;
    const bg = Math.round(255 * (1 - hitR * 0.65));
    const bb = Math.round(255 * (1 - hitR * 0.85));
    const hitColorStr = hitR > 0.02 ? `rgb(${br},${bg},${bb})` : '#fff';

    const bright = 1 - 0.25 * this.adsBlend + 0.6 * ease.outQuad(this.hitPulse);
    for (let i = 0; i < 4; i++) {
      const b = this.blades[i];
      setStyle(
        b,
        'transform',
        `rotate(${this._rot[i]}deg) translateY(${-gap.toFixed(2)}px) scaleY(${len.toFixed(3)})`
      );
      setStyle(b, 'opacity', (vis * Math.min(1, bright)).toFixed(3));
      if (hitR > 0.02) setStyle(b, 'background', `linear-gradient(to top, ${hitColorStr}aa, ${hitColorStr} 70%)`);
      else setStyle(b, 'background', 'linear-gradient(to top, rgba(255,255,255,.7), #fff 70%)');
    }
    const dotScale = 1 + this.hitPulse * 1.4;
    setStyle(this.dot, 'transform', `scale(${dotScale.toFixed(3)})`);
    setStyle(this.dot, 'opacity', (vis * (0.85 + 0.15 * this.hitPulse)).toFixed(3));
    if (hitR > 0.02) setStyle(this.dot, 'background', hitColorStr);
    else setStyle(this.dot, 'background', '#fff');
    setStyle(this.root, 'display', vis < 0.004 ? 'none' : '');
  }

  setScale(k) {
    this.k = k;
  }

  dispose() {
    this.root.remove();
  }
}
