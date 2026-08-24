/**
 * main.js
 * Main game bootstrap and fixed timestep game loop for Reverse Game.
 * Adheres strictly to game-development and clean-code architectural standards.
 */
import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { TimeManager } from './core/TimeManager.js';
import { StateBuffer } from './core/StateBuffer.js';
import { TextureGenerator } from './world/TextureGenerator.js';
import { ParticleSystem } from './world/ParticleSystem.js';
import { OpenWorld } from './world/OpenWorld.js';
import { Sky } from './world/Sky.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { TimeEcho } from './entities/TimeEcho.js';
import { SoundEffects } from './audio/SoundEffects.js';
import { EventBus } from './core/events.js';
import { UiSystem } from './ui/index.js';
import { FxSystem } from './fx/index.js';
import { Rng } from './core/rng.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.init();
  }

  async init() {
    // 1. Core Systems
    this.engine = new Engine(this.container);
    this.events = new EventBus();
    this.gameTime = { elapsed: 0, raw: performance.now() };
    this.sfx = new SoundEffects();
    this.sfx.init(this.engine.camera);
    this.timeManager = new TimeManager(this.sfx);
    this.stateBuffer = new StateBuffer(400); // 8s history @ 50Hz
    this.textureGen = new TextureGenerator();
    this.particles = new ParticleSystem(this.engine.scene);

    this.fx = new FxSystem();
    const fxCtx = {
      rng: new Rng(0xbeef1234),
      config: { q: { particleBudget: 4000 } },
      scene: this.engine.scene,
      viewScene: this.engine.scene, // Or engine.camera
      camera: this.engine.camera,
      viewCamera: this.engine.camera,
      events: this.events,
      time: this.gameTime,
      peek: (sys) => null
    };
    await this.fx.init(fxCtx);

    // 2. Sky & World
    this.sky = new Sky(this.engine.scene, this.engine.renderer);
    this.arena = new OpenWorld(this.engine.scene, this.textureGen);
    this.sky.setTimeOfDay(12.0); // Force noon bright blue

    // 3. Player & Entities
    this.player = new Player(
      this.engine.camera,
      this.textureGen,
      this.sfx,
      this.particles,
      this.arena,
      this.fx,
      this.events
    );

    this.timeEcho = new TimeEcho(
      this.engine.scene,
      this.sfx,
      this.particles
    );

    this.enemies = [];
    this.spawnInitialEnemies();

    // 4. UI Systems
    this.ui = new UiSystem();
    this.uiCtx = {
      rng: new Rng(0xbeef1234),
      time: this.gameTime,
      canvas: this.engine.renderer.domElement,
      events: this.events,
      camera: this.engine.camera,
      config: {
        sensitivity: 0.002,
        fov: 80,
        invertY: false
      },
      input: {
        enabled: true,
        frozen: false,
        get pointerLocked() { return !!document.pointerLockElement; },
        actionPressed: (action) => false, // Handled elsewhere or implement 'Escape' check
        requestPointerLock: () => document.body.requestPointerLock()
      },
      peek: (sys) => {
        if (sys === 'player') return this.player;
        if (sys === 'weapons') return this.player.weapon;
        if (sys === 'audio') return this.sfx;
        if (sys === 'render') return null;
        if (sys === 'ai') return {
          getHudActors: () => this.enemies.map(e => ({
            position: e.position,
            alive: e.isAlive,
            friendly: false,
            heading: 0
          }))
        };
        return null;
      }
    };
    await this.ui.init(this.uiCtx);

    // 5. Game Loop Timers
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fixedTimeStep = 1 / 50; // 50Hz fixed update
    this.targetPlayerState = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, health: 100, ammo: 30 };
    this.targetEnemyStates = [];

    // FPS Meter tracking
    this.fpsFrames = 0;
    this.fpsLastTime = performance.now();
    this.fpsElement = document.getElementById('hud-fps-counter');

    // Was rewinding state tracker for spawning Time Echo
    this.wasRewinding = false;

    // Start requestAnimationFrame loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  spawnInitialEnemies() {
    const enemySpawns = [
      new THREE.Vector3(-20, 1.0, -30),
      new THREE.Vector3(25,  1.0, -25),
      new THREE.Vector3(-30, 1.0, 20),
      new THREE.Vector3(35,  1.0, 15),
      new THREE.Vector3(0,   1.0, -50),
    ];

    enemySpawns.forEach((spawn) => {
      const enemy = new Enemy(
        this.engine.scene,
        this.arena,
        this.sfx,
        this.particles,
        spawn
      );
      this.enemies.push(enemy);
    });
  }

  restartMatch() {
    this.stateBuffer.reset();
    this.timeManager.reset();
    this.player.respawn(this.arena.spawnPoints[0]);
    this.timeEcho.despawn();

    const enemySpawns = [
      new THREE.Vector3(-20, 1.0, -30),
      new THREE.Vector3(25,  1.0, -25),
      new THREE.Vector3(-30, 1.0, 20),
      new THREE.Vector3(35,  1.0, 15),
      new THREE.Vector3(0,   1.0, -50),
    ];

    this.enemies.forEach((enemy, idx) => {
      enemy.respawn(enemySpawns[idx % enemySpawns.length]);
    });
  }

  exitToTitle() {
    this.restartMatch();
  }

  fixedUpdate(dt) {
    if (this.ui.menu?.open) return;

    if (this.timeManager.rewindActive) {
      // ⏪ REWIND STATE PLAYBACK
      const validState = this.stateBuffer.getRewindState(
        this.timeManager.currentRewindStep,
        this.targetPlayerState,
        this.targetEnemyStates
      );

      if (validState) {
        this.player.applyRewindState(this.targetPlayerState);
        for (let i = 0; i < this.enemies.length; i++) {
          if (this.targetEnemyStates[i]) {
            this.enemies[i].applyRewindState(this.targetEnemyStates[i]);
          }
        }
      }
      this.particles.showTemporalVortex(this.player.position, true);
    } else {
      // ▶️ FORWARD TIME RECORDING & SIMULATION
      this.particles.showTemporalVortex(this.player.position, false);

      // Check if we just exited rewind -> spawn Time Echo paradox ghost!
      if (this.wasRewinding) {
        const history = this.stateBuffer.getHistoricalPath(120);
        this.timeEcho.spawn(history);
        this.menuManager.recordEcho();
      }

      // Record snapshot to circular buffer
      this.stateBuffer.recordSnapshot(this.player, this.enemies);

      // Update AI bots
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].update(dt, this.player, this.timeManager.timeScale);
      }

      // Update Time Echo ghost
      this.timeEcho.update(dt, this.enemies);
    }

    this.wasRewinding = this.timeManager.rewindActive;
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    const rawDt = Math.min((currentTime - this.lastTime) * 0.001, 0.1);
    this.lastTime = currentTime;

    // FPS calculation
    this.fpsFrames++;
    if (currentTime - this.fpsLastTime >= 1000) {
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.fpsFrames}`;
      }
      this.fpsFrames = 0;
      this.fpsLastTime = currentTime;
    }

    if (!this.ui.menu?.open) {
      // Update Time Manager (drains gauges, interpolates scale)
      this.timeManager.update(rawDt);

      // Decoupled Fixed Timestep Accumulator
      this.accumulator += rawDt;
      while (this.accumulator >= this.fixedTimeStep) {
        this.fixedUpdate(this.fixedTimeStep);
        this.accumulator -= this.fixedTimeStep;
      }

      // Render-rate Player movement & weapon animations
      if (!this.timeManager.rewindActive) {
        this.player.update(rawDt, this.timeManager, this.enemies);
      }

      // Particle update
      this.particles.update(
        rawDt,
        this.timeManager.timeScale,
        this.timeManager.rewindActive
      );
      
      this.gameTime.elapsed += rawDt;
      this.gameTime.raw = currentTime;

      if (this.fx && this.fx.ctx) {
        this.fx.update(rawDt, this.fx.ctx);
        this.fx.lateUpdate(rawDt, this.fx.ctx);
      }

      // HUD update
      if (this.ui) {
        this.ui.lateUpdate ? this.ui.lateUpdate(rawDt, this.uiCtx) : null;
        if (this.ui.update) this.ui.update(rawDt, rawDt); // Ensure we cover both update types
      }

      // 3D Spatial Audio update
      this.sfx.update(rawDt, this.engine.camera);
    }

    // Sky & Celestial Sun update
    this.sky.update(rawDt, this.engine.camera);

    // Render frame
    this.engine.render(currentTime * 0.001, this.timeManager);
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
