/**
 * IN-GAME TACTICAL MOUSE CURSOR
 *
 * Renders a sleek military-spec cursor overlay for menus, settings, and loading
 * screens, with active targeting reticles on hover and tactile click impulse animations.
 */

const CURSOR_CSS = `
/* Hide default OS cursor when tactical cursor is active */
html, body, #game, #ui, .ow-hud, .ow-menu, .ow-loader, button, input, select, textarea, a {
  cursor: none !important;
}

.ow-cursor-layer {
  position: fixed; inset: 0; pointer-events: none; z-index: 9999999;
  overflow: hidden;
}

.ow-custom-cursor {
  position: fixed; left: 0; top: 0;
  width: 32px; height: 32px;
  transform: translate3d(-100px, -100px, 0);
  pointer-events: none; will-change: transform;
  transition: opacity 0.12s ease;
  opacity: 0;
}

.ow-cursor-pointer {
  position: absolute; left: 0; top: 0;
  width: 24px; height: 24px;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 6px rgba(255, 176, 42, 0.5));
  transition: transform 0.12s ease;
}

.ow-cursor-pointer svg {
  width: 100%; height: 100%; display: block;
}

/* Hover targeting brackets */
.ow-cursor-bracket {
  position: absolute; width: 6px; height: 6px;
  border-color: #79d2ff; opacity: 0;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.ow-cursor-bracket.tl { top: -4px; left: -4px; border-top: 1.5px solid; border-left: 1.5px solid; }
.ow-cursor-bracket.tr { top: -4px; right: 8px; border-top: 1.5px solid; border-right: 1.5px solid; }
.ow-cursor-bracket.bl { bottom: 8px; left: -4px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.ow-cursor-bracket.br { bottom: 8px; right: 8px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

.ow-custom-cursor.hover .ow-cursor-bracket {
  opacity: 1;
}
.ow-custom-cursor.hover .ow-cursor-bracket.tl { transform: translate(-3px, -3px); border-color: #ffb02a; }
.ow-custom-cursor.hover .ow-cursor-bracket.tr { transform: translate(3px, -3px); border-color: #ffb02a; }
.ow-custom-cursor.hover .ow-cursor-bracket.bl { transform: translate(-3px, 3px); border-color: #ffb02a; }
.ow-custom-cursor.hover .ow-cursor-bracket.br { transform: translate(3px, 3px); border-color: #ffb02a; }

.ow-custom-cursor.hover .ow-cursor-pointer {
  transform: scale(1.15);
}

/* Click impulse ring */
.ow-cursor-ripple {
  position: absolute; left: 2px; top: 2px;
  width: 8px; height: 8px;
  border: 2px solid #ffb02a; border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  opacity: 0; pointer-events: none;
}
.ow-cursor-ripple.active {
  animation: ow-click-pulse 0.35s ease-out forwards;
}
@keyframes ow-click-pulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-color: #ffffff; }
  50% { border-color: #ffb02a; }
  100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; border-color: rgba(255, 176, 42, 0); }
}
`;

export class TacticalCursor {
  constructor() {
    this._injectStyle();

    this.layer = document.createElement('div');
    this.layer.className = 'ow-cursor-layer';

    this.cursorEl = document.createElement('div');
    this.cursorEl.className = 'ow-custom-cursor';
    this.cursorEl.innerHTML = `
      <div class="ow-cursor-bracket tl"></div>
      <div class="ow-cursor-bracket tr"></div>
      <div class="ow-cursor-bracket bl"></div>
      <div class="ow-cursor-bracket br"></div>
      <div class="ow-cursor-ripple" id="ow-cursor-ripple"></div>
      <div class="ow-cursor-pointer">
        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Main Tactical Pointer Chevron -->
          <path d="M2 2L24 11L14 14L11 24L2 2Z" fill="#0c1218" stroke="#ffb02a" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M4.5 5.5L19.5 11.5L12.5 13.8L10.2 20.5L4.5 5.5Z" fill="url(#ow-cursor-grad)"/>
          <!-- Central Laser Aim Dot -->
          <circle cx="3" cy="3" r="1.5" fill="#ffffff"/>
          <defs>
            <linearGradient id="ow-cursor-grad" x1="4.5" y1="5.5" x2="19.5" y2="20.5" gradientUnits="userSpaceOnUse">
              <stop stop-color="#ffc86b"/>
              <stop offset="0.6" stop-color="#ffb02a"/>
              <stop offset="1" stop-color="#cc7a00"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `;

    this.layer.appendChild(this.cursorEl);
    document.body.appendChild(this.layer);

    this.rippleEl = this.cursorEl.querySelector('#ow-cursor-ripple');
    this.x = innerWidth / 2;
    this.y = innerHeight / 2;
    this.visible = false;
    this.pointerLocked = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseOver = this._onMouseOver.bind(this);
    this._onMouseOut = this._onMouseOut.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    window.addEventListener('mousemove', this._onMouseMove, { passive: true });
    window.addEventListener('pointermove', this._onMouseMove, { passive: true });
    window.addEventListener('mousedown', this._onMouseDown, { passive: true });
    window.addEventListener('mouseover', this._onMouseOver, { passive: true });
    window.addEventListener('mouseout', this._onMouseOut, { passive: true });
    document.addEventListener('mouseenter', this._onMouseEnter);
    document.addEventListener('mouseleave', this._onMouseLeave);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockChange);

    this._checkPointerLock();
  }

  _injectStyle() {
    if (document.getElementById('ow-cursor-style')) return;
    const style = document.createElement('style');
    style.id = 'ow-cursor-style';
    style.textContent = CURSOR_CSS;
    document.head.appendChild(style);
  }

  _checkPointerLock() {
    this.pointerLocked = !!document.pointerLockElement;
    this._updateVisibility();
  }

  _onPointerLockChange() {
    this.pointerLocked = !!document.pointerLockElement;
    this._updateVisibility();
  }

  _onMouseEnter() {
    if (!this.pointerLocked) {
      this.cursorEl.style.opacity = '1';
      this.visible = true;
    }
  }

  _onMouseLeave() {
    this.cursorEl.style.opacity = '0';
    this.visible = false;
  }

  _updateVisibility() {
    if (this.pointerLocked) {
      this.cursorEl.style.opacity = '0';
      this.visible = false;
    } else {
      this.cursorEl.style.opacity = '1';
      this.visible = true;
    }
  }

  _onMouseMove(e) {
    this.x = e.clientX;
    this.y = e.clientY;

    if (!this.pointerLocked) {
      this.cursorEl.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
      if (!this.visible) {
        this.cursorEl.style.opacity = '1';
        this.visible = true;
      }
    }
  }

  _onMouseDown(e) {
    if (this.pointerLocked) return;
    if (this.rippleEl) {
      this.rippleEl.classList.remove('active');
      void this.rippleEl.offsetWidth; // trigger reflow
      this.rippleEl.classList.add('active');
    }
  }

  _onMouseOver(e) {
    const target = e.target;
    if (!target) return;
    const isInteractive =
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'A' ||
      target.classList.contains('ow-row') ||
      target.classList.contains('ow-tab') ||
      target.classList.contains('ow-step-btn') ||
      target.classList.contains('ow-btn') ||
      target.classList.contains('ow-slider') ||
      target.classList.contains('ow-loader-btn') ||
      target.closest('button') ||
      target.closest('.ow-row') ||
      target.closest('.ow-tab') ||
      target.closest('.ow-btn') ||
      target.closest('.ow-loader-btn');

    if (isInteractive) {
      this.cursorEl.classList.add('hover');
    }
  }

  _onMouseOut(e) {
    this.cursorEl.classList.remove('hover');
  }

  show() {
    this.pointerLocked = false;
    this._updateVisibility();
  }

  hide() {
    this.pointerLocked = true;
    this._updateVisibility();
  }

  dispose() {
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('pointermove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseover', this._onMouseOver);
    window.removeEventListener('mouseout', this._onMouseOut);
    document.removeEventListener('mouseenter', this._onMouseEnter);
    document.removeEventListener('mouseleave', this._onMouseLeave);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockChange);
    this.layer?.remove();
  }
}
