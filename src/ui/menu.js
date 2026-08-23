import { el, setText, setStyle, clamp, damp, ease } from './util.js';
import { QUALITY_PRESETS, saveSettingsToStorage } from '../core/config.js';

const TABS = [
  { id: 'graphics', label: 'Graphics' },
  { id: 'display', label: 'Display' },
  { id: 'audio', label: 'Audio' },
  { id: 'controls', label: 'Controls' },
];

const PRESET_OPTIONS = [
  { value: 'verylow', label: 'Ultra Low (30 FPS)' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'custom', label: 'Custom' },
];

const RESOLUTION_OPTIONS = [
  { value: 0.50, label: '50% (Fastest)' },
  { value: 0.60, label: '60% (Recommended)' },
  { value: 0.72, label: '72% (Balanced)' },
  { value: 0.85, label: '85% (High Quality)' },
  { value: 1.00, label: '100% (Native)' },
];

const SHADOW_OPTIONS = [
  { value: 'off', label: 'Off (Max FPS)', size: 0, cascades: 0 },
  { value: 'low', label: 'Low (512px, 1 Cascade)', size: 512, cascades: 1 },
  { value: 'med', label: 'Medium (1024px, 2 Cascades)', size: 1024, cascades: 2 },
  { value: 'high', label: 'High (2048px, 3 Cascades)', size: 2048, cascades: 3 },
  { value: 'ultra', label: 'Ultra (4096px, 4 Cascades)', size: 4096, cascades: 4 },
];

const AA_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'fxaa', label: 'FXAA (Fast)' },
  { value: 'taa', label: 'TAA (Smooth)' },
];

const PARTICLE_OPTIONS = [
  { value: 500, label: 'Very Low (500)' },
  { value: 2000, label: 'Low (2,000)' },
  { value: 6000, label: 'Medium (6,000)' },
  { value: 12000, label: 'High (12,000)' },
  { value: 24000, label: 'Ultra (24,000)' },
];

const DECAL_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 32, label: 'Low (32)' },
  { value: 128, label: 'Medium (128)' },
  { value: 256, label: 'High (256)' },
  { value: 512, label: 'Ultra (512)' },
];

const ANISO_OPTIONS = [
  { value: 1, label: '1x (Off)' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
  { value: 8, label: '8x' },
  { value: 16, label: '16x' },
];

export class PauseMenu {
  constructor(parent, ctx) {
    this.ctx = ctx;
    this.root = el('div', 'ow-menu', parent);
    this.container = el('div', 'ow-menu-container', this.root);

    // ---- Header -----------------------------------------------------------
    const header = el('div', 'ow-menu-header', this.container);
    const titleBox = el('div', null, header);
    const h1 = el('h1', null, titleBox, 'SETTINGS');
    el('div', 'sub', titleBox, 'OVERWATCH — TACTICAL CONFIGURATION');

    this.tabBtns = [];
    const tabsWrap = el('div', 'ow-menu-tabs', header);
    for (const tab of TABS) {
      const b = el('button', 'ow-tab', tabsWrap, tab.label);
      b.type = 'button';
      b.addEventListener('click', () => this.switchTab(tab.id));
      this.tabBtns.push({ id: tab.id, btn: b });
    }

    // ---- GTA V Performance / GPU Load Meter --------------------------------
    this.meterWrap = el('div', 'ow-gpu-meter', this.container);
    const meterHeader = el('div', 'ow-gpu-meter-header', this.meterWrap);
    this.meterTitle = el('span', null, meterHeader, 'ESTIMATED GPU LOAD: 25%');
    this.meterBadge = el('span', 'ow-gpu-meter-badge ok', meterHeader, 'OPTIMAL (30+ FPS TARGET)');

    const barTrack = el('div', 'ow-gpu-bar-track', this.meterWrap);
    this.barFill = el('div', 'ow-gpu-bar-fill', barTrack);

    // ---- Main Body: Left Options + Right Description ----------------------
    const body = el('div', 'ow-menu-body', this.container);
    this.optionsContainer = el('div', 'ow-menu-options', body);

    const panel = el('div', 'ow-menu-panel', body);
    this.descBox = el('div', 'ow-desc-box', panel);
    this.descTitle = el('div', 'ow-desc-title', this.descBox, 'SETTINGS HELP');
    this.descText = el('div', 'ow-desc-text', this.descBox, 'Select any setting to see its details and performance impact on your PC.');
    this.descImpact = el('div', 'ow-desc-impact', this.descBox, 'SYSTEM IMPACT: LOW');

    // ---- Footer Actions ----------------------------------------------------
    const footer = el('div', 'ow-menu-footer', this.container);
    el('div', 'ow-hint', footer, 'ESC RESUME · ARROWS ADJUST · WASD MOVE');

    const btns = el('div', 'ow-btns', footer);
    this.resetBtn = el('button', 'ow-btn reset', btns, 'Reset to Ultra-Low (30 FPS)');
    this.resetBtn.type = 'button';
    this.resetBtn.addEventListener('click', () => this.resetToUltraLow());

    this.saveBtn = el('button', 'ow-btn primary', btns, 'Apply & Save');
    this.saveBtn.type = 'button';
    this.saveBtn.addEventListener('click', () => this.applyAndSave());

    this.resumeBtn = el('button', 'ow-btn', btns, 'Resume');
    this.resumeBtn.type = 'button';
    this.resumeBtn.addEventListener('click', () => this.close());

    this.currentTab = 'graphics';
    this.steppers = [];
    this.sliders = [];
    this.open = false;
    this.shown = 0;

    setStyle(this.root, 'display', 'none');
    this.switchTab('graphics');
  }

  // --------------------------------------------------------------------------
  // Tab Management
  // --------------------------------------------------------------------------

  switchTab(tabId) {
    this.currentTab = tabId;
    for (const t of this.tabBtns) {
      t.btn.classList.toggle('active', t.id === tabId);
    }
    this.buildTabOptions(tabId);
    this.updateGpuMeter();
  }

  buildTabOptions(tabId) {
    this.optionsContainer.innerHTML = '';
    this.steppers = [];
    this.sliders = [];
    const cfg = this.ctx.config;
    const q = cfg.q;

    if (tabId === 'graphics') {
      // 1. Overall Preset
      this._addStepper({
        name: 'Overall Graphics Preset',
        options: PRESET_OPTIONS,
        getValue: () => cfg.quality,
        onChange: (val) => {
          if (val !== 'custom') {
            cfg.setQuality(val);
            this.ctx.events.emit('ui:quality', { quality: val });
            this.buildTabOptions('graphics');
          } else {
            cfg.quality = 'custom';
          }
          this.updateGpuMeter();
        },
        desc: 'Selects a master performance preset. "Ultra Low" is heavily optimized to run at 30+ FPS on Intel HD 4000 and older dual-core CPUs by disabling expensive compute shaders.',
        impact: 'OVERALL PERFORMANCE SCALER',
      });

      // 2. Resolution Scale
      this._addStepper({
        name: 'Resolution Scale',
        options: RESOLUTION_OPTIONS,
        getValue: () => {
          const s = q.renderScale ?? 0.60;
          return RESOLUTION_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - s) < Math.abs(prev.value - s) ? curr : prev
          ).value;
        },
        onChange: (val) => {
          cfg.setCustomSetting('renderScale', val);
          this.ctx.events.emit('ui:setting', { key: 'renderScale', value: val });
          this.updateGpuMeter();
        },
        desc: 'Scales the internal 3D rendering resolution before upscaling to your screen. Lower values like 50%-60% dramatically boost frame rate on integrated graphics.',
        impact: 'VERY HIGH GPU IMPACT',
      });

      // 3. Shadow Quality
      this._addStepper({
        name: 'Shadow Quality',
        options: SHADOW_OPTIONS,
        getValue: () => {
          if (q.enableShadows === false) return 'off';
          if (q.shadowMapSize <= 512) return 'low';
          if (q.shadowMapSize <= 1024) return 'med';
          if (q.shadowMapSize <= 2048) return 'high';
          return 'ultra';
        },
        onChange: (val) => {
          const opt = SHADOW_OPTIONS.find((o) => o.value === val);
          if (val === 'off') {
            cfg.setCustomSetting('enableShadows', false);
          } else {
            cfg.setCustomSetting('enableShadows', true);
            cfg.setCustomSetting('shadowMapSize', opt.size);
            cfg.setCustomSetting('cascades', opt.cascades);
          }
          this.ctx.events.emit('ui:setting', { key: 'shadows', value: val });
          this.updateGpuMeter();
        },
        desc: 'Controls sunlight shadow resolution and cascade count. Turning shadows OFF or LOW saves up to 15ms per frame on Intel HD Graphics.',
        impact: 'VERY HIGH GPU IMPACT',
      });

      // 4. Ambient Occlusion (GTAO)
      this._addToggle({
        name: 'Ambient Occlusion (GTAO)',
        getValue: () => !!q.gtao,
        onChange: (val) => {
          cfg.setCustomSetting('gtao', val);
          this.ctx.events.emit('ui:setting', { key: 'gtao', value: val });
          this.updateGpuMeter();
        },
        desc: 'Ground Truth Ambient Occlusion marches screen-space rays to calculate soft contact shadows in corners and crevices. Turn OFF for maximum FPS.',
        impact: 'HIGH GPU IMPACT',
      });

      // 5. Screen Space Reflections (SSR)
      this._addToggle({
        name: 'Screen Space Reflections',
        getValue: () => !!q.ssr,
        onChange: (val) => {
          cfg.setCustomSetting('ssr', val);
          this.ctx.events.emit('ui:setting', { key: 'ssr', value: val });
          this.updateGpuMeter();
        },
        desc: 'Real-time raymarched reflections across wet asphalt, tile, and glossy surfaces. Very demanding on integrated GPUs.',
        impact: 'HIGH GPU IMPACT',
      });

      // 6. Volumetric Lighting & Fog
      this._addToggle({
        name: 'Volumetric Sun Rays & Fog',
        getValue: () => !!q.volumetrics,
        onChange: (val) => {
          cfg.setCustomSetting('volumetrics', val);
          this.ctx.events.emit('ui:setting', { key: 'volumetrics', value: val });
          this.updateGpuMeter();
        },
        desc: 'Raymarches light shafts (god rays) and physical fog. Disabling this saves ~9-11ms per frame for a massive 30 FPS boost.',
        impact: 'VERY HIGH GPU IMPACT',
      });

      // 7. Anti-Aliasing
      this._addStepper({
        name: 'Anti-Aliasing (AA)',
        options: AA_OPTIONS,
        getValue: () => (q.taa ? 'taa' : q.fxaa !== false ? 'fxaa' : 'off'),
        onChange: (val) => {
          if (val === 'taa') {
            cfg.setCustomSetting('taa', true);
            cfg.setCustomSetting('fxaa', false);
          } else if (val === 'fxaa') {
            cfg.setCustomSetting('taa', false);
            cfg.setCustomSetting('fxaa', true);
          } else {
            cfg.setCustomSetting('taa', false);
            cfg.setCustomSetting('fxaa', false);
          }
          this.ctx.events.emit('ui:setting', { key: 'aa', value: val });
          this.updateGpuMeter();
        },
        desc: 'Smoothes jagged geometric edges. FXAA is ultra-fast; TAA provides cinematic stability but uses more GPU power.',
        impact: 'LOW-MEDIUM GPU IMPACT',
      });

      // 8. Motion Blur
      this._addToggle({
        name: 'Tile Motion Blur',
        getValue: () => !!q.motionBlur,
        onChange: (val) => {
          cfg.setCustomSetting('motionBlur', val);
          this.ctx.events.emit('ui:setting', { key: 'motionBlur', value: val });
          this.updateGpuMeter();
        },
        desc: 'Simulates camera shutter blur during fast movements. Disabling frees up post-processing compute.',
        impact: 'LOW-MEDIUM GPU IMPACT',
      });

      // 9. Depth of Field (ADS DOF)
      this._addToggle({
        name: 'ADS Depth of Field',
        getValue: () => q.dof !== false,
        onChange: (val) => {
          cfg.setCustomSetting('dof', val);
          this.ctx.events.emit('ui:setting', { key: 'dof', value: val });
          this.updateGpuMeter();
        },
        desc: 'Blurs background scenery when aiming down weapon sights (ADS).',
        impact: 'LOW GPU IMPACT',
      });

      // 10. Bloom
      this._addToggle({
        name: 'Bloom & Lens Glint',
        getValue: () => !!q.bloom,
        onChange: (val) => {
          cfg.setCustomSetting('bloom', val);
          this.ctx.events.emit('ui:setting', { key: 'bloom', value: val });
          this.updateGpuMeter();
        },
        desc: 'High-dynamic-range light bloom from muzzle flashes, sun glints, and explosions.',
        impact: 'LOW GPU IMPACT',
      });

      // 11. Parallax Occlusion (POM)
      this._addToggle({
        name: 'Parallax Material Relief (POM)',
        getValue: () => q.pom !== false,
        onChange: (val) => {
          cfg.setCustomSetting('pom', val);
          this.ctx.events.emit('ui:setting', { key: 'pom', value: val });
          this.updateGpuMeter();
        },
        desc: 'Calculates 3D depth inside wall bricks and concrete cracks via shader raymarching. Turning OFF gives a significant FPS gain on iGPUs.',
        impact: 'MEDIUM-HIGH GPU IMPACT',
      });

      // 12. Particles
      this._addStepper({
        name: 'Particle Density',
        options: PARTICLE_OPTIONS,
        getValue: () => {
          const b = q.particleBudget ?? 2000;
          return PARTICLE_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - b) < Math.abs(prev.value - b) ? curr : prev
          ).value;
        },
        onChange: (val) => {
          cfg.setCustomSetting('particleBudget', val);
          this.ctx.events.emit('ui:setting', { key: 'particleBudget', value: val });
          this.updateGpuMeter();
        },
        desc: 'Controls maximum active GPU sparks, smoke puffs, and dust particles.',
        impact: 'MEDIUM GPU/CPU IMPACT',
      });

      // 13. Decals
      this._addStepper({
        name: 'Bullet Impact Decals',
        options: DECAL_OPTIONS,
        getValue: () => {
          const d = q.decalBudget ?? 64;
          return DECAL_OPTIONS.reduce((prev, curr) =>
            Math.abs(curr.value - d) < Math.abs(prev.value - d) ? curr : prev
          ).value;
        },
        onChange: (val) => {
          cfg.setCustomSetting('decalBudget', val);
          this.ctx.events.emit('ui:setting', { key: 'decalBudget', value: val });
          this.updateGpuMeter();
        },
        desc: 'Maximum bullet holes and scorch marks preserved in the scene.',
        impact: 'LOW IMPACT',
      });

      // 14. Anisotropic Filtering
      this._addStepper({
        name: 'Anisotropic Filtering',
        options: ANISO_OPTIONS,
        getValue: () => q.anisotropy ?? 1,
        onChange: (val) => {
          cfg.setCustomSetting('anisotropy', val);
          this.ctx.events.emit('ui:setting', { key: 'anisotropy', value: val });
          this.updateGpuMeter();
        },
        desc: 'Sharpens textures viewed at sharp grazing angles (roads, distant walls). 1x (Off) saves memory bandwidth on shared RAM.',
        impact: 'LOW-MEDIUM GPU IMPACT',
      });
    } else if (tabId === 'display') {
      // Field of View
      this._addSlider({
        name: 'Field of View (FOV)',
        min: 65,
        max: 110,
        step: 1,
        getValue: () => cfg.fov ?? 80,
        onChange: (val) => {
          cfg.fov = val;
          if (this.ctx.camera) {
            this.ctx.camera.fov = val;
            this.ctx.camera.updateProjectionMatrix();
          }
          this.ctx.events.emit('ui:fov', { value: val });
        },
        format: (v) => `${v | 0}°`,
        desc: 'Vertical/horizontal camera field of view angle. Default is 80° for tactical FPS feel.',
        impact: 'LOW PERFORMANCE IMPACT',
      });

      // Show FPS Counter
      this._addToggle({
        name: 'Show FPS & Frame-time Counter',
        getValue: () => cfg.showFps !== false,
        onChange: (val) => {
          cfg.showFps = val;
          this.ctx.events.emit('ui:setting', { key: 'showFps', value: val });
        },
        desc: 'Displays real-time FPS and frame-time (milliseconds) in the HUD to help you tune for steady 30+ FPS.',
        impact: 'NO PERFORMANCE IMPACT',
      });

      // Brightness / Exposure
      this._addSlider({
        name: 'Exposure Calibration',
        min: 0.5,
        max: 2.0,
        step: 0.05,
        getValue: () => cfg.exposure ?? 1.0,
        onChange: (val) => {
          cfg.exposure = val;
          this.ctx.events.emit('ui:setting', { key: 'exposure', value: val });
        },
        format: (v) => v.toFixed(2),
        desc: 'Adjusts overall screen brightness and exposure compensation curve.',
        impact: 'NO PERFORMANCE IMPACT',
      });
    } else if (tabId === 'audio') {
      // Master Volume
      this._addSlider({
        name: 'Master Volume',
        min: 0,
        max: 1.0,
        step: 0.05,
        getValue: () => cfg.masterVolume ?? 1.0,
        onChange: (val) => {
          cfg.masterVolume = val;
          this.ctx.events.emit('ui:setting', { key: 'masterVolume', value: val });
        },
        format: (v) => `${Math.round(v * 100)}%`,
        desc: 'Overall synthesized Web Audio sound volume.',
        impact: 'NO PERFORMANCE IMPACT',
      });

      // SFX & Weapons
      this._addSlider({
        name: 'Weapons & Foley SFX',
        min: 0,
        max: 1.0,
        step: 0.05,
        getValue: () => cfg.sfxVolume ?? 1.0,
        onChange: (val) => {
          cfg.sfxVolume = val;
          this.ctx.events.emit('ui:setting', { key: 'sfxVolume', value: val });
        },
        format: (v) => `${Math.round(v * 100)}%`,
        desc: 'Volume for procedural gunshots, mechanical slide reloads, footsteps, and shell casings.',
        impact: 'NO PERFORMANCE IMPACT',
      });

      // Voice Chatter
      this._addSlider({
        name: 'Voice & Radio Chatter',
        min: 0,
        max: 1.0,
        step: 0.05,
        getValue: () => cfg.voiceVolume ?? 1.0,
        onChange: (val) => {
          cfg.voiceVolume = val;
          this.ctx.events.emit('ui:setting', { key: 'voiceVolume', value: val });
        },
        format: (v) => `${Math.round(v * 100)}%`,
        desc: 'Volume for synthesized squad radio calls and enemy vocal chatter.',
        impact: 'NO PERFORMANCE IMPACT',
      });

      // Ambience
      this._addSlider({
        name: 'Distant Battle Ambience',
        min: 0,
        max: 1.0,
        step: 0.05,
        getValue: () => cfg.musicVolume ?? 0.7,
        onChange: (val) => {
          cfg.musicVolume = val;
          this.ctx.events.emit('ui:setting', { key: 'musicVolume', value: val });
        },
        format: (v) => `${Math.round(v * 100)}%`,
        desc: 'Volume for environmental street wind, birds, and distant artillery echoes.',
        impact: 'NO PERFORMANCE IMPACT',
      });
    } else if (tabId === 'controls') {
      // Sensitivity
      this._addSlider({
        name: 'Mouse Sensitivity',
        min: 0.2,
        max: 3.0,
        step: 0.05,
        getValue: () => (cfg.sensitivity ?? 0.0022) / 0.0022,
        onChange: (val) => {
          cfg.sensitivity = 0.0022 * val;
          this.ctx.events.emit('ui:sensitivity', { value: cfg.sensitivity, multiplier: val });
        },
        format: (v) => v.toFixed(2),
        desc: 'Sensitivity multiplier for mouse look aiming.',
        impact: 'NO PERFORMANCE IMPACT',
      });

      // Invert Look
      this._addToggle({
        name: 'Invert Vertical Look (Y Axis)',
        getValue: () => !!cfg.invertY,
        onChange: (val) => {
          cfg.invertY = val;
          this.ctx.events.emit('ui:setting', { key: 'invertY', value: val });
        },
        desc: 'Inverts up/down vertical look direction.',
        impact: 'NO PERFORMANCE IMPACT',
      });
    }
  }

  // --------------------------------------------------------------------------
  // GTA V GPU Load Estimation
  // --------------------------------------------------------------------------

  updateGpuMeter() {
    const q = this.ctx.config.q;
    let score = 0;

    // Render scale (10 to 45 pts)
    const scale = q.renderScale ?? 0.60;
    score += Math.round(scale * scale * 45);

    // Shadows (0 to 28 pts)
    if (q.enableShadows !== false) {
      if (q.shadowMapSize >= 4096) score += 28;
      else if (q.shadowMapSize >= 2048) score += 18;
      else if (q.shadowMapSize >= 1024) score += 10;
      else score += 5;
    }

    // Heavy passes
    if (q.gtao) score += 14;
    if (q.ssr) score += 15;
    if (q.volumetrics) score += 18;
    if (q.taa) score += 8;
    else if (q.fxaa) score += 2;
    if (q.motionBlur) score += 4;
    if (q.dof !== false) score += 3;
    if (q.bloom) score += 4;
    if (q.pom !== false) score += 10;
    if ((q.particleBudget ?? 2000) > 6000) score += 10;
    else if ((q.particleBudget ?? 2000) > 2000) score += 5;

    const maxScore = 150;
    const pct = Math.min(100, Math.max(12, Math.round((score / maxScore) * 100)));

    setStyle(this.barFill, 'width', `${pct}%`);
    setText(this.meterTitle, `ESTIMATED GPU LOAD: ${pct}%`);

    if (pct <= 32) {
      this.meterBadge.className = 'ow-gpu-meter-badge ok';
      setText(this.meterBadge, 'OPTIMAL FOR INTEL HD / 30+ FPS');
    } else if (pct <= 65) {
      this.meterBadge.className = 'ow-gpu-meter-badge mod';
      setText(this.meterBadge, 'MODERATE LOAD (MID-RANGE GPU)');
    } else {
      this.meterBadge.className = 'ow-gpu-meter-badge heavy';
      setText(this.meterBadge, 'HEAVY LOAD (DEDICATED GPU ONLY)');
    }
  }

  // --------------------------------------------------------------------------
  // UI Builder Helpers
  // --------------------------------------------------------------------------

  _setHelp(title, desc, impact) {
    setText(this.descTitle, title);
    setText(this.descText, desc);
    setText(this.descImpact, `SYSTEM IMPACT: ${impact}`);
  }

  _addStepper({ name, options, getValue, onChange, desc, impact }) {
    const row = el('div', 'ow-row', this.optionsContainer);
    el('div', 'name', row, name);

    const control = el('div', 'control', row);
    const stepper = el('div', 'ow-stepper', control);

    const prevBtn = el('button', 'ow-step-btn', stepper, '◀');
    prevBtn.type = 'button';
    const valText = el('div', 'ow-step-val', stepper, '');
    const nextBtn = el('button', 'ow-step-btn', stepper, '▶');
    nextBtn.type = 'button';

    const sync = () => {
      const cur = getValue();
      const idx = options.findIndex((o) => o.value === cur);
      const opt = options[idx] || options[0];
      setText(valText, opt.label);
    };

    const step = (dir) => {
      const cur = getValue();
      let idx = options.findIndex((o) => o.value === cur);
      if (idx < 0) idx = 0;
      let nextIdx = idx + dir;
      if (nextIdx < 0) nextIdx = options.length - 1;
      if (nextIdx >= options.length) nextIdx = 0;
      onChange(options[nextIdx].value);
      sync();
    };

    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    row.addEventListener('click', () => step(1));

    row.addEventListener('mouseenter', () => {
      row.classList.add('focus');
      this._setHelp(name, desc, impact);
    });
    row.addEventListener('mouseleave', () => row.classList.remove('focus'));

    sync();
  }

  _addToggle({ name, getValue, onChange, desc, impact }) {
    const options = [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ];
    this._addStepper({
      name,
      options,
      getValue: () => !!getValue(),
      onChange,
      desc,
      impact,
    });
  }

  _addSlider({ name, min, max, step, getValue, onChange, format, desc, impact }) {
    const row = el('div', 'ow-row', this.optionsContainer);
    el('div', 'name', row, name);

    const control = el('div', 'control', row);
    const wrap = el('div', 'ow-slider', control);
    el('div', 'track', wrap);
    const fill = el('div', 'fill', wrap);
    const knob = el('div', 'knob', wrap);
    const input = el('input', null, wrap);
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);

    const valEl = el('div', 'val', control, '');
    setStyle(valEl, 'font-family', 'var(--fm)');
    setStyle(valEl, 'font-size', 'calc(11px * var(--k))');
    setStyle(valEl, 'color', 'var(--amber)');
    setStyle(valEl, 'min-width', 'calc(45px * var(--k))');
    setStyle(valEl, 'text-align', 'right');

    const paint = (v) => {
      const t = (v - min) / (max - min);
      setStyle(fill, 'width', (t * 100).toFixed(2) + '%');
      setStyle(knob, 'left', (t * 100).toFixed(2) + '%');
      setText(valEl, format ? format(v) : String(v));
    };

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      onChange(v);
      paint(v);
    });

    row.addEventListener('mouseenter', () => {
      row.classList.add('focus');
      this._setHelp(name, desc, impact);
    });
    row.addEventListener('mouseleave', () => row.classList.remove('focus'));

    const initial = getValue();
    input.value = String(initial);
    paint(initial);
  }

  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------

  applyAndSave() {
    saveSettingsToStorage(this.ctx.config);
    setText(this.saveBtn, '✓ Saved!');
    setTimeout(() => {
      if (this.saveBtn) setText(this.saveBtn, 'Apply & Save');
    }, 1500);
  }

  resetToUltraLow() {
    const cfg = this.ctx.config;
    cfg.setQuality('verylow');
    cfg.fov = 80;
    cfg.sensitivity = 0.0022;
    cfg.invertY = false;
    cfg.showFps = true;
    this.ctx.events.emit('ui:quality', { quality: 'verylow' });
    this.ctx.events.emit('ui:setting', { key: 'all' });
    this.switchTab(this.currentTab);
    this.applyAndSave();
  }

  toggle() {
    this.open ? this.close() : this.show();
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.switchTab(this.currentTab);
    setStyle(this.root, 'display', 'flex');
    document.exitPointerLock?.();
    const t = this.ctx.time;
    if (t) {
      this._prevScale = t.scale;
      t.scale = 0;
    }
    this.ctx.peek('player')?.setControlEnabled?.(false);
    this.ctx.events.emit('ui:pause', { paused: true });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    const t = this.ctx.time;
    if (t) t.scale = this._prevScale ?? 1;
    this.ctx.peek('player')?.setControlEnabled?.(true);
    this.ctx.input?.requestPointerLock?.();
    this.ctx.events.emit('ui:pause', { paused: false });
  }

  update(rawDt) {
    this.shown = damp(this.shown, this.open ? 1 : 0, 14, rawDt);
    if (this.shown < 0.004) {
      setStyle(this.root, 'display', 'none');
      setStyle(this.root, 'pointer-events', 'none');
      return;
    }
    setStyle(this.root, 'display', 'flex');
    setStyle(this.root, 'pointer-events', this.open ? 'auto' : 'none');
    setStyle(this.root, 'opacity', ease.outQuad(this.shown).toFixed(3));
  }

  dispose() {
    this.root.remove();
  }
}
