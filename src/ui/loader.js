const TIPS = [
  'TIP: Press ESC at any time to open the GTA V Tactical Settings Menu and fine-tune your performance.',
  'TIP: The game defaults to Ultra-Low 30 FPS Mode for smooth play on Intel HD Graphics & laptops.',
  'TIP: Use WASD to move, Shift to Tactical Sprint, Ctrl to Slide, and Space to Jump.',
  'TIP: Right Click to Aim Down Sights (ADS) for maximum weapon stability and reduced bullet spread.',
  'TIP: Press R to Reload, Q and E to Lean around corners, and C to Crouch.',
  'TIP: Every single texture, 3D model, sound, and animation is synthesized in real-time from code.',
  'TIP: Bullets penetrate thin materials like plaster and wood with realistic velocity reduction.',
];

const SUBSYSTEM_LABELS = {
  render: 'Initializing WebGL2 HDR Render Pipeline',
  materials: 'Baking 19 Procedural PBR Textures & Normal Maps',
  sky: 'Simulating Bruneton Atmospheric Scattering',
  world: 'Constructing 120m Market Street & Building Interiors',
  physics: 'Building Binned-SAH Physics BVH (29,000 Polygons)',
  player: 'Initializing 120Hz Kinematic Character Controller',
  weapons: 'Forging Procedural Hard-Surface Firearms & Viewmodels',
  fx: 'Compiling GPU Particle Atlases & Decal Buffers',
  ai: 'Assembling Skinned Soldiers & Tactical NavMesh',
  ui: 'Mounting Tactical HUD & Radar Subsystems',
  audio: 'Synthesizing Web Audio DSP Foley & Acoustics',
  prewarm: 'Pre-compiling WebGL2 Shader Programs',
};

const LOADER_CSS = `
.ow-loader {
  position: fixed; inset: 0; z-index: 99999;
  background: radial-gradient(circle at 50% 45%, #0d141c 0%, #06090d 65%, #020305 100%);
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 4vh 5vw; color: #eef4f7;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none; transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s ease;
  overflow: hidden;
}
.ow-loader::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: 
    linear-gradient(rgba(255, 176, 42, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 176, 42, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
.ow-loader-corner {
  position: absolute; width: 16px; height: 16px; border-color: rgba(255, 176, 42, 0.4); pointer-events: none;
}
.ow-loader-tl { top: 20px; left: 20px; border-top: 2px solid; border-left: 2px solid; }
.ow-loader-tr { top: 20px; right: 20px; border-top: 2px solid; border-right: 2px solid; }
.ow-loader-bl { bottom: 20px; left: 20px; border-bottom: 2px solid; border-left: 2px solid; }
.ow-loader-br { bottom: 20px; right: 20px; border-bottom: 2px solid; border-right: 2px solid; }

.ow-loader-header {
  display: flex; justify-content: space-between; align-items: flex-start;
}
.ow-loader-brand {
  display: flex; flex-direction: column; gap: 4px;
}
.ow-loader-badge {
  font-size: 11px; font-weight: 700; letter-spacing: 0.25em; color: #ffb02a;
  text-transform: uppercase; display: flex; align-items: center; gap: 8px;
}
.ow-loader-badge::before {
  content: ''; display: inline-block; width: 8px; height: 8px; background: #ffb02a;
  border-radius: 50%; box-shadow: 0 0 8px #ffb02a; animation: ow-pulse 1.4s infinite ease-in-out;
}
@keyframes ow-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

.ow-loader-title {
  font-size: clamp(28px, 4.5vw, 44px); font-weight: 900; letter-spacing: 0.15em;
  color: #ffffff; text-transform: uppercase; text-shadow: 0 2px 12px rgba(0,0,0,0.8);
  margin-top: 2px;
}
.ow-loader-sub {
  font-size: 11px; font-weight: 600; letter-spacing: 0.2em; color: rgba(214, 227, 234, 0.6);
  text-transform: uppercase;
}

.ow-loader-center {
  max-width: 680px; width: 100%; margin: auto; display: flex; flex-direction: column; gap: 14px;
}
.ow-loader-status-row {
  display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px;
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
}
.ow-loader-status-text {
  color: #79d2ff; text-shadow: 0 0 10px rgba(121, 210, 255, 0.4);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;
}
.ow-loader-pct {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 18px; font-weight: 700; color: #ffb02a;
}

.ow-loader-bar-bg {
  position: relative; width: 100%; height: 10px; background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16); overflow: hidden; border-radius: 2px;
}
.ow-loader-bar-fill {
  height: 100%; width: 0%;
  background: linear-gradient(90deg, #ff9000, #ffb02a, #79d2ff);
  box-shadow: 0 0 14px rgba(255, 176, 42, 0.8);
  transition: width 0.18s ease-out;
}

.ow-loader-btn {
  display: none; align-items: center; justify-content: center;
  width: 100%; padding: 16px 24px; margin-top: 10px;
  background: #ffb02a; border: 1px solid #ffc86b; color: #080c10;
  font-size: 14px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
  cursor: pointer; transition: all 0.15s ease;
  box-shadow: 0 0 25px rgba(255, 176, 42, 0.4);
}
.ow-loader-btn:hover {
  background: #ffc251; transform: scale(1.01); box-shadow: 0 0 35px rgba(255, 176, 42, 0.6);
}

.ow-loader-footer {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px;
}
.ow-loader-tip-box {
  display: flex; align-items: center; gap: 10px; font-size: 12px;
  letter-spacing: 0.06em; color: rgba(214, 227, 234, 0.8); line-height: 1.4;
}
.ow-loader-tip-icon {
  background: rgba(255, 176, 42, 0.15); border: 1px solid rgba(255, 176, 42, 0.4);
  color: #ffb02a; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 2px;
}
.ow-loader-ver {
  font-family: ui-monospace, monospace; font-size: 10px; color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.1em;
}
`;

export class LoadingScreen {
  constructor() {
    this._injectStyle();

    this.root = document.createElement('div');
    this.root.className = 'ow-loader';
    this.root.innerHTML = `
      <div class="ow-loader-corner ow-loader-tl"></div>
      <div class="ow-loader-corner ow-loader-tr"></div>
      <div class="ow-loader-corner ow-loader-bl"></div>
      <div class="ow-loader-corner ow-loader-br"></div>

      <div class="ow-loader-header">
        <div class="ow-loader-brand">
          <div class="ow-loader-badge">TACTICAL DEPLOYMENT // OPERATION: MARKET STREET</div>
          <div class="ow-loader-title">OVERWATCH</div>
          <div class="ow-loader-sub">CLAUDE OF DUTY — 100% PROCEDURAL FPS</div>
        </div>
      </div>

      <div class="ow-loader-center">
        <div class="ow-loader-status-row">
          <span class="ow-loader-status-text" id="ow-loader-msg">INITIALIZING PROCEDURAL ENGINE...</span>
          <span class="ow-loader-pct" id="ow-loader-pct">0%</span>
        </div>
        <div class="ow-loader-bar-bg">
          <div class="ow-loader-bar-fill" id="ow-loader-bar"></div>
        </div>
        <button type="button" class="ow-loader-btn" id="ow-loader-btn">
          DEPLOY OPERATOR (CLICK TO START)
        </button>
      </div>

      <div class="ow-loader-footer">
        <div class="ow-loader-tip-box">
          <span class="ow-loader-tip-icon">INTEL</span>
          <span id="ow-loader-tip">${TIPS[0]}</span>
        </div>
        <div class="ow-loader-ver">BUILD v1.0.4 · WEBGL2</div>
      </div>
    `;

    document.body.appendChild(this.root);

    this.msgEl = this.root.querySelector('#ow-loader-msg');
    this.pctEl = this.root.querySelector('#ow-loader-pct');
    this.barEl = this.root.querySelector('#ow-loader-bar');
    this.btnEl = this.root.querySelector('#ow-loader-btn');
    this.tipEl = this.root.querySelector('#ow-loader-tip');

    this._tipIndex = 0;
    this._tipInterval = setInterval(() => this._rotateTip(), 3200);
    this.currentPercent = 0;
    this.isReady = false;
  }

  _injectStyle() {
    if (document.getElementById('ow-loader-style')) return;
    const style = document.createElement('style');
    style.id = 'ow-loader-style';
    style.textContent = LOADER_CSS;
    document.head.appendChild(style);
  }

  _rotateTip() {
    if (!this.tipEl) return;
    this._tipIndex = (this._tipIndex + 1) % TIPS.length;
    this.tipEl.style.opacity = '0';
    setTimeout(() => {
      if (this.tipEl) {
        this.tipEl.textContent = TIPS[this._tipIndex];
        this.tipEl.style.opacity = '1';
      }
    }, 200);
  }

  updateProgress(percent, customMsg) {
    const num = Number(percent);
    if (Number.isFinite(num)) {
      this.currentPercent = Math.min(100, Math.max(this.currentPercent, Math.round(num)));
    }
    if (this.pctEl) this.pctEl.textContent = `${this.currentPercent}%`;
    if (this.barEl) this.barEl.style.width = `${this.currentPercent}%`;
    if (this.msgEl && customMsg) this.msgEl.textContent = customMsg.toUpperCase();
  }

  reportSubsystem(id, step, total) {
    const s = Number(step) || 0;
    const t = Number(total) || 11;
    const rawPct = Math.min(75, (s / Math.max(1, t)) * 75);
    const label = SUBSYSTEM_LABELS[id] || `INITIALIZING ${id.toUpperCase()} SUBSYSTEM`;
    this.updateProgress(rawPct, label);
  }

  reportPrewarm(step, total) {
    let fraction = 0;
    if (typeof total === 'number' && total > 0 && typeof step === 'number') {
      fraction = Math.min(1, Math.max(0, step / total));
    } else if (typeof step === 'number' && step <= 1) {
      fraction = Math.min(1, Math.max(0, step));
    }
    const rawPct = 75 + fraction * 25;
    const stepLabel = (typeof total === 'number' && typeof step === 'number' && step >= 1) ? ` (${Math.round(step)}/${Math.round(total)})` : '';
    this.updateProgress(rawPct, `Pre-compiling shader programs${stepLabel}...`);
  }

  setReady(onDeploy) {
    if (this.isReady) return;
    this.isReady = true;
    this.updateProgress(100, 'MISSION READY. TACTICAL SYSTEMS ONLINE.');
    if (this.barEl) {
      this.barEl.style.background = 'linear-gradient(90deg, #3db845, #a8e86a)';
      this.barEl.style.boxShadow = '0 0 16px rgba(168, 232, 106, 0.8)';
    }

    if (this.btnEl) {
      this.btnEl.style.display = 'flex';
      const handleDeploy = () => {
        this.dismiss();
        onDeploy?.();
      };
      this.btnEl.addEventListener('click', handleDeploy);
      this.root.addEventListener('click', handleDeploy);
    }
  }

  dismiss() {
    clearInterval(this._tipInterval);
    if (!this.root) return;
    this.root.style.opacity = '0';
    this.root.style.transform = 'scale(1.02)';
    this.root.style.pointerEvents = 'none';
    setTimeout(() => {
      this.root?.remove();
      this.root = null;
    }, 600);
  }
}
