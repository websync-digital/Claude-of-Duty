import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';
import { LoadingScreen } from './ui/loader.js';
import { TacticalCursor } from './ui/cursor.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
// Deterministic shutter for the pixel gate: the engine does not schedule its own
// frames, the driver advances exactly N of them through window.__PUMP__. Opt-in,
// because tools that measure real frame pacing (tools/perf.mjs) need the loop to
// free-run. See the long comment in src/dev/shots.js.
const lockstep = capture && params.get('lockstep') === '1';

const configOverrides = {
  deterministic: capture,
};
if (params.has('q')) {
  configOverrides.quality = params.get('q');
}
const config = createConfig(configOverrides);

const canvas = document.getElementById('game');
const cursor = capture ? null : new TacticalCursor();
const loader = capture ? null : new LoadingScreen();

const engine = new Engine({ canvas, config });

// Registration order is irrelevant — Registry topo-sorts on static deps.
engine
  .add(RenderSystem)
  .add(MaterialSystem)
  .add(SkySystem)
  .add(WorldSystem)
  .add(PhysicsSystem)
  .add(PlayerSystem)
  .add(WeaponSystem)
  .add(FxSystem)
  .add(AiSystem)
  .add(UiSystem)
  .add(AudioSystem);

try {
  await engine.init(({ index, total, id }) => {
    loader?.reportSubsystem(id, index, total);
  });
} catch (err) {
  console.error('[boot] init failed', err);
  loader?.dismiss();
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:0;padding:2rem;color:#f66;background:#000;
       font:12px/1.5 ui-monospace,monospace;overflow:auto;z-index:9999;white-space:pre-wrap">
BOOT FAILURE\n\n${err.stack ?? err.message}</pre>`
  );
  throw err;
}

const shotApi = installShotApi(engine, { capture, lockstep });

// Compile every shader permutation before the frame loop starts. Measured: without
// this, 86 programs compile lazily during play, up to 30 on one frame, producing
// 3.1-3.9 SECOND stalls. See src/core/prewarm.js.
const warmup =
  params.get('prewarm') === '0'
    ? { ok: false, reason: 'disabled by ?prewarm=0' }
    : await prewarm(engine, {
        onProgress: (step, total) => loader?.reportPrewarm(step, total),
      });
console.info('[boot] prewarm', warmup);
window.__PREWARM__ = warmup;

engine.start();

// Capture harness handshake: only flag ready once a frame has actually landed.
const BOOT_FRAMES = 3;
if (lockstep) {
  await shotApi.pump(BOOT_FRAMES);
  window.__READY__ = true;
} else {
  let warm = 0;
  const readyProbe = () => {
    if (++warm >= BOOT_FRAMES) {
      window.__READY__ = true;
      if (params.get('fast') === '1' || params.get('skip') === '1') {
        loader?.dismiss();
        engine.ctx.input?.requestPointerLock?.();
      } else {
        loader?.setReady(() => {
          engine.ctx.input?.requestPointerLock?.();
        });
      }
      return;
    }
    requestAnimationFrame(readyProbe);
  };
  requestAnimationFrame(readyProbe);
}

// Global live development handles for instant real-time tweaking in DevTools
window.__ENGINE__ = engine;
window.__CTX__ = engine.ctx;
window.__CONFIG__ = engine.ctx.config;
window.__PLAYER__ = engine.ctx.peek('player');
window.__WEAPONS__ = engine.ctx.peek('weapons');
window.__DEV__ = {
  setFps(fps) { engine.ctx.config.setQuality(fps <= 30 ? 'verylow' : 'medium'); },
  setFov(fov) { engine.camera.fov = fov; engine.camera.updateProjectionMatrix(); },
  godMode() { const p = engine.ctx.peek('player'); if (p) p.health.value = 99999; },
  spawnEnemy() { engine.ctx.peek('ai')?.debugStage?.('firefight'); },
  heal() { engine.ctx.peek('player')?.health?.heal(100); },
  setQuality(q) { engine.ctx.config.setQuality(q); engine.ctx.events.emit('ui:quality', { quality: q }); },
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => engine.dispose());
}
