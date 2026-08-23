/**
 * Central tuning + quality configuration.
 * Subsystems read from here rather than hardcoding magic numbers, so the
 * quality scaler and the capture harness can drive everything from one place.
 */

export const PHYSICS_HZ = 120;
export const FIXED_DT = 1 / PHYSICS_HZ;
/** Never simulate more than this many physics steps in one frame (spiral-of-death guard). */
export const MAX_SUBSTEPS = 8;

/** Real-world units are metres, seconds, kilograms. */
export const UNITS = {
  gravity: -9.81 * 2.1, // Games use exaggerated gravity; CoD-like feel.
  playerHeight: 1.78,
  playerCrouchHeight: 1.12,
  playerRadius: 0.32,
  eyeOffset: 0.12, // below top of capsule
};

export const QUALITY_PRESETS = {
  verylow: {
    name: 'Ultra Low (30 FPS Mode)',
    renderScale: 0.60,
    enableShadows: false,
    shadowMapSize: 512,
    cascades: 1,
    shadowDistance: 35,
    taa: false,
    fxaa: false,
    gtao: false,
    ssr: false,
    volumetrics: false,
    motionBlur: false,
    bloom: false,
    dof: false,
    pom: false,
    anisotropy: 1,
    particleBudget: 500,
    decalBudget: 16,
  },
  low: {
    name: 'Low',
    renderScale: 0.72,
    enableShadows: true,
    shadowMapSize: 1024,
    cascades: 2,
    shadowDistance: 60,
    taa: false,
    fxaa: true,
    gtao: false,
    ssr: false,
    volumetrics: false,
    motionBlur: false,
    bloom: true,
    dof: false,
    pom: false,
    anisotropy: 2,
    particleBudget: 2000,
    decalBudget: 64,
  },
  medium: {
    name: 'Medium',
    renderScale: 0.85,
    enableShadows: true,
    shadowMapSize: 2048,
    cascades: 3,
    shadowDistance: 90,
    taa: true,
    fxaa: false,
    gtao: true,
    ssr: false,
    volumetrics: true,
    motionBlur: true,
    bloom: true,
    dof: true,
    pom: true,
    anisotropy: 8,
    particleBudget: 6000,
    decalBudget: 128,
  },
  high: {
    name: 'High',
    renderScale: 1.0,
    enableShadows: true,
    shadowMapSize: 2048,
    cascades: 4,
    shadowDistance: 140,
    taa: true,
    fxaa: false,
    gtao: true,
    ssr: true,
    volumetrics: true,
    motionBlur: true,
    bloom: true,
    dof: true,
    pom: true,
    anisotropy: 16,
    particleBudget: 12000,
    decalBudget: 256,
  },
  ultra: {
    name: 'Ultra',
    renderScale: 1.0,
    enableShadows: true,
    shadowMapSize: 4096,
    cascades: 4,
    shadowDistance: 200,
    taa: true,
    fxaa: false,
    gtao: true,
    ssr: true,
    volumetrics: true,
    motionBlur: true,
    bloom: true,
    dof: true,
    pom: true,
    anisotropy: 16,
    particleBudget: 24000,
    decalBudget: 512,
  },
};

export const DEFAULTS = {
  quality: 'verylow',
  fov: 80, // horizontal-ish vertical FOV, CoD default feel
  adsFovScale: 0.72,
  sensitivity: 0.0022,
  adsSensScale: 0.65,
  invertY: false,
  exposure: 1.0,
  showFps: true,
  masterVolume: 1.0,
  sfxVolume: 1.0,
  voiceVolume: 1.0,
  musicVolume: 0.7,
  /** Capture mode disables anything nondeterministic so screenshots are stable. */
  deterministic: false,
};

const STORAGE_KEY = 'cod_settings_v1';

export function loadSavedSettings() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[config] failed to load saved settings', err);
    return null;
  }
}

export function saveSettingsToStorage(cfg) {
  try {
    if (typeof localStorage === 'undefined') return;
    const data = {
      quality: cfg.quality,
      fov: cfg.fov,
      sensitivity: cfg.sensitivity,
      invertY: cfg.invertY,
      exposure: cfg.exposure,
      showFps: cfg.showFps,
      masterVolume: cfg.masterVolume,
      sfxVolume: cfg.sfxVolume,
      voiceVolume: cfg.voiceVolume,
      musicVolume: cfg.musicVolume,
      q: { ...cfg.q },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[config] failed to save settings', err);
  }
}

export function createConfig(overrides = {}) {
  const saved = loadSavedSettings();
  const base = { ...DEFAULTS };
  if (saved) {
    Object.assign(base, saved);
  }
  const cfg = { ...base, ...overrides };

  // Setup quality preset or custom settings
  const basePreset = QUALITY_PRESETS[cfg.quality] || QUALITY_PRESETS.verylow;
  cfg.q = { ...basePreset, ...(saved?.q || {}), ...(overrides.q || {}) };

  cfg.setQuality = (name) => {
    if (name === 'custom') {
      cfg.quality = 'custom';
      return;
    }
    if (!QUALITY_PRESETS[name]) throw new Error(`unknown quality preset "${name}"`);
    cfg.quality = name;
    Object.assign(cfg.q, QUALITY_PRESETS[name]);
  };

  cfg.setCustomSetting = (key, value) => {
    if (key in cfg.q) {
      cfg.q[key] = value;
      cfg.quality = 'custom';
    } else if (key in cfg) {
      cfg[key] = value;
    }
  };

  return cfg;
}
