/**
 * Central tuning + quality configuration.
 */
export const PHYSICS_HZ = 120;
export const FIXED_DT = 1 / PHYSICS_HZ;
export const MAX_SUBSTEPS = 8;

export const UNITS = {
  gravity: -9.81 * 2.1, // Games use exaggerated gravity; CoD-like feel.
  playerHeight: 1.78,
  playerCrouchHeight: 1.12,
  playerRadius: 0.32,
  eyeOffset: 0.12, // below top of capsule
};

export const QUALITY_PRESETS = {
  low: {
    renderScale: 0.75,
    shadowMapSize: 1024,
    bloom: false,
    postProcessing: false,
  },
  medium: {
    renderScale: 0.9,
    shadowMapSize: 1024,
    bloom: true,
    postProcessing: true,
  },
  high: {
    renderScale: 1.0,
    shadowMapSize: 2048,
    bloom: true,
    postProcessing: true,
  },
};
