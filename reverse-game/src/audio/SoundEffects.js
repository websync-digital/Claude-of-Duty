/**
 * SoundEffects.js
 * Physics-Accurate Procedural Gunshot & Weapon Acoustics Engine for Reverse Game.
 * Based on real firearm acoustic ballistics:
 * 1. Supersonic Shockwave (Mach N-Wave Crack @ 3-6kHz)
 * 2. High-Pressure Muzzle Blast (Non-linear saturated downward pitch sweep 195Hz -> 40Hz)
 * 3. Combustion Gas Deflagration (Bandpassed turbulent noise 800Hz-1.8kHz)
 * 4. Mechanical Action Cycle (Bolt carrier group metallic slap @ +28ms)
 * 5. Ground-Slap Acoustic Dissipation (Fast falling lowpass tail without convolver lag)
 * 6. Dynamic Round-Robin Timbre Jitter (Every single shot has unique micro-physics)
 */

export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.weaponsGain = null;
    this.foleyGain = null;
    this.uiGain = null;
    this.initialized = false;
    this.camera = null;

    this.settings = {
      master: 0.95,
      weapons: 1.15,
      foley: 0.85,
      ui: 0.85,
      rewind: 0.9,
    };

    // Pre-calculated Noise Buffers & Waveshaper Curves (Zero-GC)
    this.noiseBuffers = {};
    this.distortionCurves = {};
    this.shotCounter = 0;
  }

  init(camera = null) {
    if (this.initialized) return;
    this.camera = camera;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.settings.master, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Fast-attack dynamics compressor for authentic tactical punch
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(3, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.0008, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.06, this.ctx.currentTime);
      this.compressor.connect(this.masterGain);

      // Weapons Bus
      this.weaponsGain = this.ctx.createGain();
      this.weaponsGain.gain.setValueAtTime(this.settings.weapons, this.ctx.currentTime);
      this.weaponsGain.connect(this.compressor);

      // Foley & UI Buses
      this.foleyGain = this.ctx.createGain();
      this.foleyGain.gain.setValueAtTime(this.settings.foley, this.ctx.currentTime);
      this.foleyGain.connect(this.masterGain);

      this.uiGain = this.ctx.createGain();
      this.uiGain.gain.setValueAtTime(this.settings.ui, this.ctx.currentTime);
      this.uiGain.connect(this.masterGain);

      // Build zero-GC lookup buffers
      this.generateNoiseBuffers();
      this.generateDistortionCurves();

      // Instant user-gesture auto resume
      const unlockAudio = () => this.resume();
      ['click', 'keydown', 'mousedown', 'pointerdown', 'touchstart'].forEach((ev) => {
        window.addEventListener(ev, unlockAudio, { passive: true });
      });

      this.initialized = true;
    } catch (e) {
      console.warn('[audio] Web Audio init error:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  generateNoiseBuffers() {
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * 1.5;

    // White Noise (Mach Shockwave & High Transients)
    const whiteBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const whiteData = whiteBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.white = whiteBuf;

    // Pink Noise (Combustion Gas Texture)
    const pinkBuf = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const pinkData = pinkBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;
    }
    this.noiseBuffers.pink = pinkBuf;
  }

  generateDistortionCurves() {
    // S-curve for heavy non-linear acoustic compression
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    const k = 45;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    this.distortionCurves.blast = curve;
  }

  update(dt, camera) {
    this.camera = camera;
  }

  setMasterVolume(val) {
    this.settings.master = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.settings.master, this.ctx.currentTime, 0.02);
    }
  }

  setSFXVolume(val) {
    this.settings.weapons = Math.max(0, Math.min(1, val * 1.2));
    this.settings.foley = Math.max(0, Math.min(1, val));
    if (this.weaponsGain && this.ctx) {
      this.weaponsGain.gain.setTargetAtTime(this.settings.weapons, this.ctx.currentTime, 0.02);
      this.foleyGain.gain.setTargetAtTime(this.settings.foley, this.ctx.currentTime, 0.02);
    }
  }

  setRewindVolume(val) {
    this.settings.rewind = Math.max(0, Math.min(1, val));
  }

  /* ========================================================================
     PHYSICS-BASED AAA REALISTIC GUNSHOT SYNTHESIS
     ======================================================================== */

  playGunshot(firstPerson = true, position = null, weaponType = 'rifle') {
    if (!this.initialized) this.init();
    if (!this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    this.shotCounter++;

    // Micro-jitter per shot (eliminates robotic repetition)
    const pitchJitter = 1.0 + (Math.random() - 0.5) * 0.06;
    const gainJitter = 1.0 + (Math.random() - 0.5) * 0.08;

    // 3D Spatial Panner if originating in world space
    let outputNode = this.weaponsGain;
    if (!firstPerson && position && this.camera) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 4;
      panner.maxDistance = 140;
      panner.rolloffFactor = 1.1;
      panner.positionX.setValueAtTime(position.x, t);
      panner.positionY.setValueAtTime(position.y, t);
      panner.positionZ.setValueAtTime(position.z, t);
      panner.connect(this.weaponsGain);
      outputNode = panner;
    }

    const level = (firstPerson ? 1.0 : 0.65) * gainJitter;

    /* ------------------------------------------------------------------------
       1. SUPERSONIC MACH N-WAVE CRACK (Instant <1ms Attack)
       ------------------------------------------------------------------------ */
    if (this.noiseBuffers.white) {
      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = this.noiseBuffers.white;
      crackSrc.playbackRate.setValueAtTime(pitchJitter * 1.25, t);

      const crackHP = this.ctx.createBiquadFilter();
      crackHP.type = 'highpass';
      crackHP.frequency.setValueAtTime(2600 * pitchJitter, t);

      const crackPeak = this.ctx.createBiquadFilter();
      crackPeak.type = 'peaking';
      crackPeak.frequency.setValueAtTime(4800 * pitchJitter, t);
      crackPeak.gain.setValueAtTime(10, t);
      crackPeak.Q.setValueAtTime(1.5, t);

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(1.3 * level, t);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      crackSrc.connect(crackHP);
      crackHP.connect(crackPeak);
      crackPeak.connect(crackGain);
      crackGain.connect(outputNode);

      crackSrc.start(t);
      crackSrc.stop(t + 0.02);

      // Acoustic Snap Impulse
      const snapOsc = this.ctx.createOscillator();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(2100 * pitchJitter, t);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.7 * level, t);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);

      snapOsc.connect(snapGain);
      snapGain.connect(outputNode);
      snapOsc.start(t);
      snapOsc.stop(t + 0.01);
    }

    /* ------------------------------------------------------------------------
       2. MUZZLE BLAST GAS EXPANSION (Saturated Low-Frequency Chest Thump)
       ------------------------------------------------------------------------ */
    {
      const startF = (weaponType === 'ak' ? 175 : 205) * pitchJitter;
      const endF = (weaponType === 'ak' ? 34 : 42) * pitchJitter;

      // Primary downward sweep
      const blastOsc1 = this.ctx.createOscillator();
      blastOsc1.type = 'sine';
      blastOsc1.frequency.setValueAtTime(startF, t);
      blastOsc1.frequency.exponentialRampToValueAtTime(endF, t + 0.075);

      // Secondary sub harmonic
      const blastOsc2 = this.ctx.createOscillator();
      blastOsc2.type = 'triangle';
      blastOsc2.frequency.setValueAtTime(startF * 0.65, t);
      blastOsc2.frequency.exponentialRampToValueAtTime(endF * 0.75, t + 0.085);

      const blastGain = this.ctx.createGain();
      blastGain.gain.setValueAtTime(1.45 * level, t);
      blastGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      const shaper = this.ctx.createWaveShaper();
      if (this.distortionCurves.blast) {
        shaper.curve = this.distortionCurves.blast;
      }

      const blastLP = this.ctx.createBiquadFilter();
      blastLP.type = 'lowpass';
      blastLP.frequency.setValueAtTime(1800, t);

      blastOsc1.connect(blastGain);
      blastOsc2.connect(blastGain);
      blastGain.connect(shaper);
      shaper.connect(blastLP);
      blastLP.connect(outputNode);

      blastOsc1.start(t);
      blastOsc2.start(t);
      blastOsc1.stop(t + 0.13);
      blastOsc2.stop(t + 0.13);

      // Sub-bass heavy drop
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(65 * pitchJitter, t);
      subOsc.frequency.exponentialRampToValueAtTime(28, t + 0.14);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.9 * level, t);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      subOsc.connect(subGain);
      subGain.connect(outputNode);
      subOsc.start(t);
      subOsc.stop(t + 0.16);
    }

    /* ------------------------------------------------------------------------
       3. COMBUSTION GAS BODY & MID-BAND DEFLAGRATION
       ------------------------------------------------------------------------ */
    if (this.noiseBuffers.pink) {
      const midSrc = this.ctx.createBufferSource();
      midSrc.buffer = this.noiseBuffers.pink;

      const midBP = this.ctx.createBiquadFilter();
      midBP.type = 'bandpass';
      midBP.frequency.setValueAtTime(1250 * pitchJitter, t);
      midBP.Q.setValueAtTime(1.8, t);

      const midGain = this.ctx.createGain();
      midGain.gain.setValueAtTime(1.1 * level, t);
      midGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      midSrc.connect(midBP);
      midBP.connect(midGain);
      midGain.connect(outputNode);

      midSrc.start(t);
      midSrc.stop(t + 0.09);
    }

    /* ------------------------------------------------------------------------
       4. MECHANICAL BOLT CARRIER SLAP (+28ms)
       ------------------------------------------------------------------------ */
    if (firstPerson) {
      const mechT = t + 0.026;
      const boltOsc = this.ctx.createOscillator();
      boltOsc.type = 'triangle';
      boltOsc.frequency.setValueAtTime(2800, mechT);
      boltOsc.frequency.exponentialRampToValueAtTime(950, mechT + 0.035);

      const boltGain = this.ctx.createGain();
      boltGain.gain.setValueAtTime(0.0001, t);
      boltGain.gain.setValueAtTime(0.48, mechT);
      boltGain.gain.exponentialRampToValueAtTime(0.0001, mechT + 0.04);

      boltOsc.connect(boltGain);
      boltGain.connect(outputNode);
      boltOsc.start(mechT);
      boltOsc.stop(mechT + 0.045);
    }

    /* ------------------------------------------------------------------------
       5. ACOUSTIC DISPERSION & GROUND SLAPBACK TAIL
       ------------------------------------------------------------------------ */
    if (this.noiseBuffers.pink) {
      const tailSrc = this.ctx.createBufferSource();
      tailSrc.buffer = this.noiseBuffers.pink;

      const tailLP = this.ctx.createBiquadFilter();
      tailLP.type = 'lowpass';
      tailLP.frequency.setValueAtTime(4200, t);
      tailLP.frequency.exponentialRampToValueAtTime(320, t + 0.32);

      const tailGain = this.ctx.createGain();
      tailGain.gain.setValueAtTime(0.65 * level, t + 0.004);
      tailGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      tailSrc.connect(tailLP);
      tailLP.connect(tailGain);
      tailGain.connect(outputNode);

      tailSrc.start(t);
      tailSrc.stop(t + 0.36);
    }
  }

  /* ========================================================================
     SUPERSONIC BULLET CRACK (FLYBY WHIZZ)
     ======================================================================== */

  playBulletWhizz(position = null, miss = 1.0) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(3200, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.055);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.Q.setValueAtTime(3.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.foleyGain);

    osc.start(t);
    osc.stop(t + 0.075);
  }

  /* ========================================================================
     BALLISTIC SURFACE IMPACTS & CASINGS
     ======================================================================== */

  playImpact(position, surface = 'metal', energy = 1.0) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    if (surface === 'flesh') {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.07);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7 * energy, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.foleyGain);
      osc.start(t);
      osc.stop(t + 0.09);
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(3600, t);
      osc.frequency.exponentialRampToValueAtTime(950, t + 0.045);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.42 * energy, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

      osc.connect(gain);
      gain.connect(this.foleyGain);
      osc.start(t);
      osc.stop(t + 0.065);
    }
  }

  playShellDrop(position, surface = 'concrete') {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.32;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(5200, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.022);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);

    osc.connect(gain);
    gain.connect(this.foleyGain);
    osc.start(t);
    osc.stop(t + 0.032);
  }

  /* ========================================================================
     TACTICAL UI SOUNDS (HITMARKER, HEADSHOT, KILL)
     ======================================================================== */

  playHitMarker(isHeadshot = false) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = isHeadshot ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 2400 : 1450, t);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 3100 : 700, t + 0.045);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isHeadshot ? 0.5 : 0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  playKill() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(850, t);
    osc.frequency.exponentialRampToValueAtTime(1750, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /* ========================================================================
     RELOAD SEQUENCE & FOOTSTEPS
     ======================================================================== */

  playReload() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    // Mag Out
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(800, t);
    osc1.frequency.exponentialRampToValueAtTime(260, t + 0.055);
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.38, t);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc1.connect(gain1);
    gain1.connect(this.foleyGain);
    osc1.start(t);
    osc1.stop(t + 0.065);

    // Mag In (+0.45s)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(340, t + 0.45);
    osc2.frequency.exponentialRampToValueAtTime(1050, t + 0.51);
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.setValueAtTime(0.35, t + 0.45);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    osc2.connect(gain2);
    gain2.connect(this.foleyGain);
    osc2.start(t + 0.45);
    osc2.stop(t + 0.53);

    // Slide Rack (+0.9s)
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(1550, t + 0.9);
    osc3.frequency.exponentialRampToValueAtTime(520, t + 0.96);
    const gain3 = this.ctx.createGain();
    gain3.gain.setValueAtTime(0.0001, t);
    gain3.gain.setValueAtTime(0.4, t + 0.9);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t + 0.97);
    osc3.connect(gain3);
    gain3.connect(this.foleyGain);
    osc3.start(t + 0.9);
    osc3.stop(t + 0.98);
  }

  playFootstep(surface = 'concrete', gait = 'run') {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    osc.connect(gain);
    gain.connect(this.foleyGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playEnemyBark(kind = 'spot', position = null) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(kind === 'death' ? 180 : 360, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'death' ? 75 : 230, t + 0.14);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, t);
    filter.Q.setValueAtTime(2.5, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.foleyGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  /* ========================================================================
     TEMPORAL TIME-WARP & REWIND AUDIO
     ======================================================================== */

  playBulletTimeToggle(enter = true) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    if (enter) {
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.26);
    } else {
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.22);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);

    osc.connect(gain);
    gain.connect(this.uiGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  playRewindLoop(active) {
    if (!this.ctx) return;
    this.resume();

    if (active) {
      if (this.rewindOsc) return;

      const t = this.ctx.currentTime;
      this.rewindOsc = this.ctx.createOscillator();
      this.rewindOsc.type = 'sawtooth';
      this.rewindOsc.frequency.setValueAtTime(110, t);
      this.rewindOsc.frequency.linearRampToValueAtTime(500, t + 0.45);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(440, t);
      filter.Q.setValueAtTime(3.5, t);

      this.rewindGain = this.ctx.createGain();
      this.rewindGain.gain.setValueAtTime(0.0001, t);
      this.rewindGain.gain.linearRampToValueAtTime(0.5 * this.settings.rewind, t + 0.15);

      this.rewindOsc.connect(filter);
      filter.connect(this.rewindGain);
      this.rewindGain.connect(this.weaponsGain);

      this.rewindOsc.start(t);
    } else if (this.rewindOsc) {
      const t = this.ctx.currentTime;
      this.rewindGain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      this.rewindOsc.stop(t + 0.1);
      this.rewindOsc = null;
      this.rewindGain = null;
    }
  }

  playEmptyClick() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Metallic dry fire click
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(4200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.03);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, t);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5 * this.settings.weapons, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.weaponsGain);
    
    osc.start(t);
    osc.stop(t + 0.035);
  }

  playHitmarker(isHeadshot) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Classic satisfying hit pip
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1200 : 800, t);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 2400 : 1600, t + 0.08);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * this.settings.ui, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    
    osc.connect(gain);
    gain.connect(this.uiGain);
    
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playShellDrop(position, surface = 'concrete') {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(6000, t);
    osc.frequency.exponentialRampToValueAtTime(8000, t + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3 * this.settings.foley, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.foleyGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  playImpact(position, material = 'concrete', intensity = 1.0) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(material === 'flesh' ? 200 : 800, t);
    osc.frequency.exponentialRampToValueAtTime(material === 'flesh' ? 50 : 100, t + 0.1);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8 * intensity * this.settings.foley, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain);
    gain.connect(this.foleyGain);
    osc.start(t);
    osc.stop(t + 0.11);
  }

  /**
   * FOOTSTEP — layered synthesis matching real outdoor terrain acoustics.
   *
   * A footstep has three physical events happening in rapid succession:
   *   1. HEEL STRIKE: initial impact transient (<80Hz body thud + 200-600Hz broadband)
   *   2. MID-SOLE LOAD: the weight settles (~80-300Hz rumble, 20-40ms duration)
   *   3. TOE-OFF SCRAPE: brief surface friction as the foot pushes off (1-3kHz)
   *
   * Surface tuning:
   *   dirt/grass  — muffled, earthy, lower frequencies, short tail
   *   concrete    — sharper, slightly longer ring, more high-frequency content
   *   gravel      — multiple small rock clicks layered on top
   *   metal       — resonant ring, boosted mids
   */
  playFootstep(surface = 'concrete', type = 'run') {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const vol = this.settings.foley * this.settings.master;

    // Volume by movement type
    const typeVol = type === 'sprint' ? 1.1 : type === 'run' ? 0.85 : type === 'jump' ? 0.7 : type === 'land' ? 1.3 : 0.5;
    const v = vol * typeVol;

    // Micro-randomise every step so they never sound identical
    const jitter = 0.88 + Math.random() * 0.24;

    // Surface-specific tuning
    const cfg = {
      dirt:     { impact: 55,  impactAmt: 0.55, mid: 160,  midQ: 0.9, scrape: 800,  scrapeVol: 0.06, ring: false },
      grass:    { impact: 48,  impactAmt: 0.45, mid: 130,  midQ: 0.8, scrape: 600,  scrapeVol: 0.04, ring: false },
      concrete: { impact: 75,  impactAmt: 0.70, mid: 220,  midQ: 1.2, scrape: 1800, scrapeVol: 0.12, ring: true  },
      metal:    { impact: 90,  impactAmt: 0.60, mid: 320,  midQ: 2.0, scrape: 2500, scrapeVol: 0.18, ring: true  },
      gravel:   { impact: 60,  impactAmt: 0.55, mid: 180,  midQ: 1.0, scrape: 1400, scrapeVol: 0.14, ring: false },
      wood:     { impact: 65,  impactAmt: 0.60, mid: 250,  midQ: 1.5, scrape: 1200, scrapeVol: 0.10, ring: true  },
    }[surface] ?? { impact: 65, impactAmt: 0.60, mid: 200, midQ: 1.0, scrape: 1200, scrapeVol: 0.10, ring: false };

    // ── Layer 1: HEEL STRIKE — low body thud ──────────────────────────────
    const heelOsc = this.ctx.createOscillator();
    heelOsc.type = 'sine';
    heelOsc.frequency.setValueAtTime(cfg.impact * jitter, t);
    heelOsc.frequency.exponentialRampToValueAtTime(cfg.impact * 0.35, t + 0.055);

    const heelGain = this.ctx.createGain();
    heelGain.gain.setValueAtTime(cfg.impactAmt * v, t);
    heelGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    heelOsc.connect(heelGain);
    heelGain.connect(this.foleyGain);
    heelOsc.start(t);
    heelOsc.stop(t + 0.07);

    // ── Layer 2: MID-SOLE LOAD — broadband noise, surface-filtered ────────
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffers.pink;
    noiseSource.loop = true;

    const midFilter = this.ctx.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.setValueAtTime(cfg.mid, t);
    midFilter.Q.setValueAtTime(cfg.midQ, t);

    const midGain = this.ctx.createGain();
    midGain.gain.setValueAtTime(0.28 * v * jitter, t);
    midGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    noiseSource.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(this.foleyGain);
    noiseSource.start(t);
    noiseSource.stop(t + 0.08);

    // ── Layer 3: TOE-OFF SCRAPE — high-freq friction (+35ms) ─────────────
    const scrapeNoise = this.ctx.createBufferSource();
    scrapeNoise.buffer = this.noiseBuffers.white;
    scrapeNoise.loop = true;

    const scrapeFilter = this.ctx.createBiquadFilter();
    scrapeFilter.type = 'highpass';
    scrapeFilter.frequency.setValueAtTime(cfg.scrape, t + 0.035);

    const scrapeGain = this.ctx.createGain();
    scrapeGain.gain.setValueAtTime(0.0, t + 0.030);
    scrapeGain.gain.linearRampToValueAtTime(cfg.scrapeVol * v, t + 0.040);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);

    scrapeNoise.connect(scrapeFilter);
    scrapeFilter.connect(scrapeGain);
    scrapeGain.connect(this.foleyGain);
    scrapeNoise.start(t + 0.030);
    scrapeNoise.stop(t + 0.08);

    // ── Layer 4: SURFACE RING (concrete/metal/wood only) ──────────────────
    if (cfg.ring) {
      const ringOsc = this.ctx.createOscillator();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(cfg.scrape * 1.4 * jitter, t);

      const ringGain = this.ctx.createGain();
      ringGain.gain.setValueAtTime(0.06 * v, t);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      ringOsc.connect(ringGain);
      ringGain.connect(this.foleyGain);
      ringOsc.start(t);
      ringOsc.stop(t + 0.10);
    }

    // ── LANDING: add heavy sub-bass impact if landing from a jump ─────────
    if (type === 'land') {
      const landOsc = this.ctx.createOscillator();
      landOsc.type = 'sine';
      landOsc.frequency.setValueAtTime(42, t);
      landOsc.frequency.exponentialRampToValueAtTime(18, t + 0.18);

      const landGain = this.ctx.createGain();
      landGain.gain.setValueAtTime(0.85 * v, t);
      landGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

      landOsc.connect(landGain);
      landGain.connect(this.foleyGain);
      landOsc.start(t);
      landOsc.stop(t + 0.25);
    }
  }

  playReload() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(300, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4 * this.settings.weapons, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.weaponsGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playEnemyBark(type, position) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(type === 'hurt' ? 300 : 200, t);
    osc.frequency.exponentialRampToValueAtTime(type === 'hurt' ? 200 : 100, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * this.settings.foley, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.foleyGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playBulletTimeToggle(active) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(active ? 800 : 200, t);
    osc.frequency.exponentialRampToValueAtTime(active ? 200 : 800, t + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8 * this.settings.ui, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  /**
   * MAG RELEASE + SLIDE OUT
   * Research: Sharp metallic "snick" (mag catch disengaging, 3-6kHz transient)
   * + brief polymer-on-metal friction slide (mid-range texture, ~800-2kHz falling)
   */
  playMagOut() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const vol = this.settings.weapons * this.settings.master;

    // --- Layer 1: Mag catch CLICK (sharp metallic transient, 3-5kHz) ---
    const clickOsc = this.ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(4800, t);
    clickOsc.frequency.exponentialRampToValueAtTime(1200, t + 0.018);

    const clickFilter = this.ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(3500, t);
    clickFilter.Q.setValueAtTime(2.5, t);

    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.55 * vol, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.weaponsGain);
    clickOsc.start(t);
    clickOsc.stop(t + 0.028);

    // --- Layer 2: Polymer slide friction (mid-range noise, 800-2kHz) ---
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffers.white;
    noiseSource.loop = true;

    const slideFilter = this.ctx.createBiquadFilter();
    slideFilter.type = 'bandpass';
    slideFilter.frequency.setValueAtTime(1400, t + 0.008);
    slideFilter.frequency.exponentialRampToValueAtTime(600, t + 0.16);
    slideFilter.Q.setValueAtTime(1.8, t);

    const slideGain = this.ctx.createGain();
    slideGain.gain.setValueAtTime(0.0, t);
    slideGain.gain.linearRampToValueAtTime(0.18 * vol, t + 0.02);
    slideGain.gain.setValueAtTime(0.14 * vol, t + 0.05);
    slideGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    noiseSource.connect(slideFilter);
    slideFilter.connect(slideGain);
    slideGain.connect(this.weaponsGain);
    noiseSource.start(t + 0.008);
    noiseSource.stop(t + 0.2);

    // --- Layer 3: Low body thump (the weapon body vibrating slightly) ---
    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(95, t + 0.005);
    bodyOsc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.18 * vol, t + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.weaponsGain);
    bodyOsc.start(t + 0.005);
    bodyOsc.stop(t + 0.11);
  }

  /**
   * MAG INSERTION — SEAT + CATCH LOCK
   * Research: "thwack" (mag hitting the well, low-freq impact <200Hz)
   * + immediate "click" (mag catch engaging, 2-4kHz sharp transient)
   * These two happen ~12ms apart in a real tactical reload.
   */
  playMagIn() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const vol = this.settings.weapons * this.settings.master;

    // --- Layer 1: Magazine THWACK impact (low-freq body impact) ---
    const impactOsc = this.ctx.createOscillator();
    impactOsc.type = 'sine';
    impactOsc.frequency.setValueAtTime(160, t);
    impactOsc.frequency.exponentialRampToValueAtTime(38, t + 0.09);

    const impactGain = this.ctx.createGain();
    impactGain.gain.setValueAtTime(0.72 * vol, t);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

    impactOsc.connect(impactGain);
    impactGain.connect(this.weaponsGain);
    impactOsc.start(t);
    impactOsc.stop(t + 0.11);

    // --- Layer 2: Mid-range polymer slap (the well walls) ---
    const slapNoise = this.ctx.createBufferSource();
    slapNoise.buffer = this.noiseBuffers.pink;
    slapNoise.loop = true;

    const slapFilter = this.ctx.createBiquadFilter();
    slapFilter.type = 'bandpass';
    slapFilter.frequency.setValueAtTime(900, t);
    slapFilter.Q.setValueAtTime(1.5, t);

    const slapGain = this.ctx.createGain();
    slapGain.gain.setValueAtTime(0.3 * vol, t);
    slapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    slapNoise.connect(slapFilter);
    slapFilter.connect(slapGain);
    slapGain.connect(this.weaponsGain);
    slapNoise.start(t);
    slapNoise.stop(t + 0.09);

    // --- Layer 3: Mag CATCH click (sharp 2-4kHz metallic lock, +12ms) ---
    const catchOsc = this.ctx.createOscillator();
    catchOsc.type = 'square';
    catchOsc.frequency.setValueAtTime(3800, t + 0.012);
    catchOsc.frequency.exponentialRampToValueAtTime(900, t + 0.038);

    const catchFilter = this.ctx.createBiquadFilter();
    catchFilter.type = 'highpass';
    catchFilter.frequency.setValueAtTime(2000, t + 0.012);

    const catchGain = this.ctx.createGain();
    catchGain.gain.setValueAtTime(0.45 * vol, t + 0.012);
    catchGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

    catchOsc.connect(catchFilter);
    catchFilter.connect(catchGain);
    catchGain.connect(this.weaponsGain);
    catchOsc.start(t + 0.012);
    catchOsc.stop(t + 0.05);
  }

  /**
   * CHARGING HANDLE / BOLT CARRIER SLAP
   * Research:
   *  - Retraction: high-tension metallic "shing" (spring compression, 4-8kHz rising-to-falling)
   *  - Release: heavy bolt slam (broadband metallic clack + low thud, <200Hz body resonance)
   * The bolt slam is the most satisfying sound of any reload — it has both a sharp
   * metal transient AND a heavy sub-bass frame vibration.
   */
  playMagSlap() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const vol = this.settings.weapons * this.settings.master;

    // === PHASE 1: Charging handle RACK (spring tension, 0-60ms) ===

    // Spring compression "shing" — rising high freq noise
    const rackNoise = this.ctx.createBufferSource();
    rackNoise.buffer = this.noiseBuffers.white;
    rackNoise.loop = true;

    const rackFilter = this.ctx.createBiquadFilter();
    rackFilter.type = 'bandpass';
    rackFilter.frequency.setValueAtTime(2000, t);
    rackFilter.frequency.exponentialRampToValueAtTime(6500, t + 0.035);
    rackFilter.frequency.exponentialRampToValueAtTime(1500, t + 0.065);
    rackFilter.Q.setValueAtTime(2.2, t);

    const rackGain = this.ctx.createGain();
    rackGain.gain.setValueAtTime(0.0, t);
    rackGain.gain.linearRampToValueAtTime(0.22 * vol, t + 0.015);
    rackGain.gain.setValueAtTime(0.2 * vol, t + 0.04);
    rackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

    rackNoise.connect(rackFilter);
    rackFilter.connect(rackGain);
    rackGain.connect(this.weaponsGain);
    rackNoise.start(t);
    rackNoise.stop(t + 0.08);

    // === PHASE 2: Bolt SLAM HOME (+70ms — spring fully released) ===
    const slamT = t + 0.07;

    // Sub-bass frame vibration (the whole gun resonating, <200Hz)
    const frameOsc = this.ctx.createOscillator();
    frameOsc.type = 'sine';
    frameOsc.frequency.setValueAtTime(130, slamT);
    frameOsc.frequency.exponentialRampToValueAtTime(45, slamT + 0.12);

    const frameGain = this.ctx.createGain();
    frameGain.gain.setValueAtTime(0.65 * vol, slamT);
    frameGain.gain.exponentialRampToValueAtTime(0.0001, slamT + 0.14);

    frameOsc.connect(frameGain);
    frameGain.connect(this.weaponsGain);
    frameOsc.start(slamT);
    frameOsc.stop(slamT + 0.15);

    // Sharp metallic transient (bolt carrier group hitting the barrel extension, 2-6kHz)
    const metalOsc = this.ctx.createOscillator();
    metalOsc.type = 'sawtooth';
    metalOsc.frequency.setValueAtTime(5500, slamT);
    metalOsc.frequency.exponentialRampToValueAtTime(400, slamT + 0.025);

    const metalFilter = this.ctx.createBiquadFilter();
    metalFilter.type = 'bandpass';
    metalFilter.frequency.setValueAtTime(4000, slamT);
    metalFilter.Q.setValueAtTime(1.4, slamT);

    const metalGain = this.ctx.createGain();
    metalGain.gain.setValueAtTime(0.6 * vol, slamT);
    metalGain.gain.exponentialRampToValueAtTime(0.0001, slamT + 0.032);

    metalOsc.connect(metalFilter);
    metalFilter.connect(metalGain);
    metalGain.connect(this.weaponsGain);
    metalOsc.start(slamT);
    metalOsc.stop(slamT + 0.035);

    // Broadband "ring" — the receiver ringing slightly after bolt impact
    const ringNoise = this.ctx.createBufferSource();
    ringNoise.buffer = this.noiseBuffers.pink;
    ringNoise.loop = true;

    const ringFilter = this.ctx.createBiquadFilter();
    ringFilter.type = 'peaking';
    ringFilter.frequency.setValueAtTime(2800, slamT);
    ringFilter.gain.setValueAtTime(14, slamT);
    ringFilter.Q.setValueAtTime(4, slamT);

    const ringGain = this.ctx.createGain();
    ringGain.gain.setValueAtTime(0.18 * vol, slamT);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, slamT + 0.18);

    ringNoise.connect(ringFilter);
    ringFilter.connect(ringGain);
    ringGain.connect(this.weaponsGain);
    ringNoise.start(slamT);
    ringNoise.stop(slamT + 0.2);
  }
}

