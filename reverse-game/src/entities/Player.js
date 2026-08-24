/**
 * Player.js
 * Advanced First-Person Player Controller for Reverse Game with:
 * - Second-Order Damped Spring Physics (Strafe Roll, Land Impact Dip, Weapon Sway)
 * - Modern Tactical Movement (Tactical Sprint, Slide, Slide-Canceling, Vault Jump)
 * - Dynamic Procedural Gait Head Bobbing
 * - Realistic Footstep & Ground Impact Audio Triggers
 * - Full Temporal Rewind & Bullet-Time Integration
 */
import * as THREE from 'three';
import { Weapon } from './Weapon.js';
import { Spring, clamp, lerp, DEG } from '../player/springs.js';

export class Player {
  constructor(camera, textureGen, soundEffects, particleSystem, arena, fx, events) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.textureGen = textureGen;
    this.sfx = soundEffects;
    this.particles = particleSystem;
    this.arena = arena;
    this.fx = fx;
    this.events = events;

    // Movement Parameters
    this.walkSpeed = 5.2;
    this.sprintSpeed = 8.2;
    this.tacSprintSpeed = 10.2;
    this.crouchSpeed = 2.8;
    this.slideSpeed = 11.8;
    this.jumpForce = 8.0;
    this.gravity = 22.0;

    // Stance Dimensions
    this.standingHeight = 1.72;
    this.crouchHeight = 1.05;
    this.slideHeight = 0.85;
    this.currentHeight = this.standingHeight;
    this.radius = 0.42;

    // State
    this.position = new THREE.Vector3(0, this.standingHeight, 16);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.isGrounded = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.85;

    // Health and Shields
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 50;
    this.shield = 50;
    this.isAlive = true;
    this.deathTimer = 0;

    // Controls Configuration
    this.mouseSensitivity = 0.0032;
    this.invertY = false;
    this.isMouseDown = false;

    // Springs for procedural camera physics
    this.rollSpring = new Spring(12, 0.75, 0);
    this.landSpring = new Spring(14, 0.65, 0);
    this.bobCycle = 0;

    // Footstep audio timer
    this.stepTimer = 0;

    // Input States
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      crouch: false,
      jump: false,
      fire: false,
      ads: false,
      reload: false,
      rewind: false,
      bulletTime: false,
    };
    this.mouseDelta = new THREE.Vector2();

    // Weapon
    this.fx = fx;
    this.weapon = new Weapon(camera, textureGen, soundEffects, particleSystem, fx);

    this.setupPointerLock();
    this.setupKeyboard();
  }

  setupPointerLock() {
    let lastClientX = 0;
    let lastClientY = 0;

    document.addEventListener('mousemove', (e) => {
      let dx = 0;
      let dy = 0;

      if (document.pointerLockElement) {
        dx = (e.movementX !== undefined) ? e.movementX : ((e.mozMovementX !== undefined) ? e.mozMovementX : (e.webkitMovementX || 0));
        dy = (e.movementY !== undefined) ? e.movementY : ((e.mozMovementY !== undefined) ? e.mozMovementY : (e.webkitMovementY || 0));
      } else if (this.isMouseDown) {
        dx = e.clientX - lastClientX;
        dy = e.clientY - lastClientY;
      }
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (dx !== 0 || dy !== 0) {
        this.mouseDelta.set(dx, dy);

        this.yaw -= dx * this.mouseSensitivity;
        const yFactor = this.invertY ? 1 : -1;
        this.pitch += dy * this.mouseSensitivity * yFactor;

        // Clamp vertical pitch (-85deg to +85deg)
        this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupKeyboard() {
    this.activeKeys = new Set();

    const updateInputs = (e) => {
      const keys = this.activeKeys;
      const isShift = e ? e.shiftKey : false;

      this.input.forward = keys.has('KeyW') || keys.has('ArrowUp') || keys.has('w') || keys.has('up') || keys.has('Numpad8');
      this.input.backward = keys.has('KeyS') || keys.has('ArrowDown') || keys.has('s') || keys.has('down') || keys.has('Numpad2');
      this.input.left = keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('a') || keys.has('left') || keys.has('Numpad4');
      this.input.right = keys.has('KeyD') || keys.has('ArrowRight') || keys.has('d') || keys.has('right') || keys.has('Numpad6');
      this.input.sprint = isShift || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('shift');
      this.input.crouch = keys.has('KeyC') || keys.has('c') || keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('control');
      this.input.jump = keys.has('Space') || keys.has(' ');
      this.input.rewind = keys.has('KeyQ') || keys.has('q');
      this.input.bulletTime = keys.has('KeyE') || keys.has('e');
    };

    window.addEventListener('keydown', (e) => {
      if (e.code) this.activeKeys.add(e.code);
      if (e.key) this.activeKeys.add(e.key.toLowerCase());

      const keyLower = e.key ? e.key.toLowerCase() : '';
      if (e.code === 'KeyR' || keyLower === 'r') {
        this.weapon.reload();
      }
      if (e.code === 'KeyT' || keyLower === 't') {
        this.weapon.inspect();
      }
      if (e.code === 'KeyB' || keyLower === 'b') {
        this.weapon.cycleFireMode();
      }
      if (e.code === 'Digit1' || keyLower === '1') {
        this.weapon.setWeapon('smg');
      }
      if (e.code === 'Digit2' || keyLower === '2') {
        this.weapon.setWeapon('pistol');
      }
      if ((e.code === 'KeyC' || keyLower === 'c') && this.isSprinting && this.isGrounded && !this.isSliding) {
        this.startSlide();
      }
      if (e.code === 'Space' && this.isSliding) {
        this.isSliding = false;
      }
      updateInputs(e);
    });

    window.addEventListener('wheel', (e) => {
      const weaponIds = ['rifle', 'smg', 'pistol'];
      const currentIdx = weaponIds.indexOf(this.weapon.activeId);
      if (e.deltaY > 0) {
        const next = weaponIds[(currentIdx + 1) % weaponIds.length];
        this.weapon.setWeapon(next);
      } else if (e.deltaY < 0) {
        const prev = weaponIds[(currentIdx - 1 + weaponIds.length) % weaponIds.length];
        this.weapon.setWeapon(prev);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code) this.activeKeys.delete(e.code);
      if (e.key) this.activeKeys.delete(e.key.toLowerCase());
      updateInputs(e);
    });

    window.addEventListener('blur', () => {
      this.activeKeys.clear();
      this.resetInputs();
    });

    window.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      if (!document.pointerLockElement) {
        // If clicking inside the game window, request pointer lock
        if (!e.target.closest('#hud-pause-btn') && !e.target.closest('#pause-menu-overlay') && !e.target.closest('#start-screen')) {
          document.body.requestPointerLock();
        }
      }
      if (e.button === 0) this.input.fire = true;
      if (e.button === 2) {
        this.input.ads = true;
        this.weapon.setAiming(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      this.isMouseDown = false;
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) {
        this.input.ads = false;
        this.weapon.setAiming(false);
      }
    });
  }

  resetInputs() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.input.crouch = false;
    this.input.jump = false;
    this.input.fire = false;
    this.input.ads = false;
    this.input.rewind = false;
    this.input.bulletTime = false;
    this.isMouseDown = false;
    if (this.weapon) this.weapon.setAiming(false);
  }

  startSlide() {
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    this.rollSpring.impulse(this.input.left ? 4 * DEG : -4 * DEG);
    this.sfx.playFootstep('concrete', 'slide');
  }

  takeDamage(amount) {
    if (!this.isAlive) return;

    if (this.shield > 0) {
      const shieldDmg = Math.min(this.shield, amount);
      this.shield -= shieldDmg;
      amount -= shieldDmg;
    }

    this.health = Math.max(0, this.health - amount);
    this.landSpring.impulse(0.08); // Camera jolt on hit
    if (this.events) {
      this.events.emit('damage:taken', { amount, health: this.health, from: arguments[1]?.position });
    }
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.deathTimer = 0;
    }
  }

  update(dt, timeManager, enemies) {
    // Handle Time-Rewind activation (allowed even during casualty to reverse death!)
    if (this.input.rewind) {
      timeManager.startRewind();
    } else if (timeManager.rewindActive) {
      timeManager.stopRewind();
    }

    // If player is dead: process rewind rescue or auto-respawn timer
    if (!this.isAlive || this.health <= 0) {
      this.isAlive = false;
      if (!timeManager.rewindActive) {
        this.deathTimer = (typeof this.deathTimer === 'number' && !isNaN(this.deathTimer)) ? this.deathTimer + dt : dt;
        if (this.deathTimer >= 2.0 || this.input.jump) {
          this.respawn();
          return;
        }
      }
      this.camera.position.copy(this.position);
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }

    // Handle Bullet-Time toggle
    if (this.input.bulletTime) {
      timeManager.toggleBulletTime();
      this.input.bulletTime = false;
    }

    // Update Springs
    this.rollSpring.step(dt);
    this.landSpring.step(dt);

    // Slide state handling
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0 || !this.isGrounded) {
        this.isSliding = false;
      }
    }

    // Dynamic Height calculation
    let targetHeight = this.standingHeight;
    if (this.isSliding) targetHeight = this.slideHeight;
    else if (this.input.crouch) targetHeight = this.crouchHeight;

    this.currentHeight += (targetHeight - this.currentHeight) * Math.min(1.0, dt * 14);
    this.isCrouching = this.input.crouch;

    // Movement Speed calculation (Unified & Unrestricted for both walking and running)
    let speed = this.walkSpeed;
    if (this.isSliding) {
      const progress = 1 - (this.slideTimer / this.slideDuration);
      speed = lerp(this.slideSpeed, this.crouchSpeed, progress);
    } else if (this.isCrouching) {
      speed = this.crouchSpeed;
    } else if (this.input.sprint && (this.input.forward || this.input.left || this.input.right || this.input.backward)) {
      speed = this.sprintSpeed;
      this.isSprinting = true;
    } else {
      this.isSprinting = false;
    }

    // Movement Vectors based on Camera Yaw
    const moveX = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const moveZ = (this.input.backward ? 1 : 0) - (this.input.forward ? 1 : 0);
    const isMoving = (moveX !== 0 || moveZ !== 0) && this.isGrounded;

    // Dynamic Strafe Camera Bank / Roll
    const targetRoll = (-moveX * 1.6 * DEG) + (this.isSliding ? (moveX < 0 ? 3 * DEG : -3 * DEG) : 0);
    this.rollSpring.target = targetRoll;

    const moveVector = new THREE.Vector3(moveX, 0, moveZ);
    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.velocity.x = moveVector.x * speed;
      this.velocity.z = moveVector.z * speed;
    } else if (!this.isSliding) {
      this.velocity.x *= 0.78;
      this.velocity.z *= 0.78;
    }

    // Jump with slide preservation
    if (this.input.jump && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.landSpring.impulse(0.04);
      this.sfx.playFootstep('concrete', 'jump');
    }

    // Gravity
    const wasGrounded = this.isGrounded;
    const prevVelY = this.velocity.y;
    this.velocity.y -= this.gravity * dt;

    // Desired next position
    const nextPos = this.position.clone();
    nextPos.x += this.velocity.x * dt;
    nextPos.z += this.velocity.z * dt;
    nextPos.y += this.velocity.y * dt;

    // Arena Floor collision
    if (nextPos.y <= this.currentHeight) {
      nextPos.y = this.currentHeight;
      this.velocity.y = 0;
      this.isGrounded = true;

      // Heavy landing detection
      if (!wasGrounded && prevVelY < -4.0) {
        this.landSpring.impulse(clamp(-prevVelY * 0.015, 0.04, 0.12));
        this.sfx.playFootstep('concrete', 'land');
      }
    } else {
      this.isGrounded = false;
    }

    // Horizontal Arena Wall/Cover Collision check
    const testPos = new THREE.Vector3(nextPos.x, this.position.y, nextPos.z);
    if (!this.arena.checkCollision(testPos, this.radius)) {
      this.position.x = nextPos.x;
      this.position.z = nextPos.z;
    }
    this.position.y = nextPos.y;

    // Procedural Gait Head Bobbing & Footsteps
    let bobX = 0;
    let bobY = 0;
    if (isMoving && !this.isSliding) {
      const stepFreq = this.isSprinting ? 12 : 8;
      this.bobCycle += dt * stepFreq;

      const amp = this.isSprinting ? 0.035 : 0.018;
      bobX = Math.sin(this.bobCycle * 0.5) * amp * 0.6;
      bobY = Math.abs(Math.sin(this.bobCycle)) * amp;

      // Trigger footstep on bob valley
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.isSprinting ? 0.28 : 0.42;
        this.sfx.playFootstep('concrete', this.isSprinting ? 'sprint' : 'run');
      }
    }

    // Apply Camera orientation & position with Spring offsets
    this.camera.position.set(
      this.position.x + bobX,
      this.position.y + bobY - this.landSpring.value,
      this.position.z
    );

    this.camera.rotation.set(this.pitch, this.yaw, this.rollSpring.value, 'YXZ');

    // Weapon continuous fire if mouse down
    if (this.input.fire && !timeManager.rewindActive) {
      this.weapon.fire(enemies, this.arena.colliders, this.position);
    }

    // Update weapon sway, bobbing, recoil
    this.weapon.update(dt, isMoving, this.isSprinting, this.mouseDelta);
    this.mouseDelta.set(0, 0);
  }

  applyRewindState(state) {
    this.position.set(state.x, state.y, state.z);
    this.yaw = state.yaw;
    this.pitch = state.pitch;
    this.health = Math.min(this.maxHealth, Math.max(0, state.health));
    this.weapon.ammo = state.ammo;

    if (this.health > 0) {
      this.isAlive = true;
      this.deathTimer = 0;
    }

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  respawn(spawnPoint) {
    this.position.copy(spawnPoint || this.arena.spawnPoints[0]);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.isAlive = true;
    this.deathTimer = 0;
    this.isSliding = false;
    this.yaw = 0;
    this.pitch = 0;
    this.rollSpring.set(0);
    this.landSpring.set(0);
    this.weapon.reset();
  }

  getHudState() {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      armour: this.shield,
      maxArmour: this.maxShield,
      regen: false,
      move: (this.input.forward || this.input.left || this.input.backward || this.input.right) ? 1 : 0,
      sprint: this.isSprinting,
      crouch: this.isCrouching,
      ads: this.weapon?.viewmodel?.ads > 0,
      airborne: !this.isGrounded,
      position: this.position
    };
  }
}
