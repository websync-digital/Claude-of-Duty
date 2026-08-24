/**
 * Weapon.js
 * Comprehensive tactical firearm controller:
 * - Multi-weapon arsenal (Pulse-AR, Vector-SMG, Sidearm Pistol)
 * - Dynamic fire modes (Full-Auto, 3-Round Burst, Semi-Auto)
 * - Procedural rig integration (Viewmodel) for sway, bob, recoil, lag
 * - Shell ejection, tracers, and hit detection
 */
import * as THREE from 'three';
import { Viewmodel } from '../weapons/viewmodel.js';
import { WeaponMaterials } from '../weapons/materials.js';
import { WEAPON_DEFS } from '../weapons/defs.js';
import { buildRifle } from '../weapons/models/rifle.js';
import { buildSmg } from '../weapons/models/smg.js';
import { buildPistol } from '../weapons/models/pistol.js';

export class Weapon {
  constructor(camera, textureGen, soundEffects, particleSystem, fx, events) {
    this.camera = camera;
    this.sfx = soundEffects;
    this.particles = particleSystem;
    this.fx = fx;
    this.events = events;

    this.mats = new WeaponMaterials({ peek: () => null });
    
    // Mock RNG and context for Viewmodel
    const rng = {
      signed: () => Math.random() * 2 - 1,
      float: () => Math.random(),
      fork: function() { return this; }
    };
    
    const ctx = {
      rng,
      viewScene: this.camera.parent, // The world scene
      viewCamera: this.camera, 
      camera: this.camera
    };

    this.viewmodel = new Viewmodel(ctx, this.mats);
    this.viewmodel.trackCamera = true; 
    
    this.viewmodel.onClipEvent = this.handleClipEvent.bind(this);

    // Build the arsenal
    const builders = { smg: buildSmg, pistol: buildPistol };
    for (const id of ['smg', 'pistol']) {
      const def = { ...WEAPON_DEFS[id] };
      def.cycleTime = 60 / def.rpm;
      const m = builders[id]();
      this.viewmodel.addWeapon(m, def);
    }

    this.activeId = 'smg';
    this.viewmodel.setActive(this.activeId);
    this.viewmodel.play('draw');
    this.config = WEAPON_DEFS[this.activeId];

    this.magCapacity = this.config.magSize;
    this.ammo = this.config.magSize;
    this.totalAmmo = this.config.reserve;
    this.isReloading = false;
    
    this.fireRate = 60 / this.config.rpm;
    this.fireTimer = 0;
    this.fireMode = 'auto'; // 'auto' | 'burst' | 'semi'
    
    this.isAiming = false;
    this.isInspecting = false;
    
    this.raycaster = new THREE.Raycaster();
    
    this.inventory = {
      rifle: { ammo: 30, total: 210, mode: 'auto' },
      smg: { ammo: 40, total: 160, mode: 'auto' },
      pistol: { ammo: 15, total: 60, mode: 'semi' },
    };
  }

  setWeapon(id) {
    if (this.activeId === id) return;
    
    if (this.inventory[this.activeId]) {
      this.inventory[this.activeId].ammo = this.ammo;
      this.inventory[this.activeId].total = this.totalAmmo;
      this.inventory[this.activeId].mode = this.fireMode;
    }

    this.activeId = id;
    this.viewmodel.setActive(id);
    this.config = WEAPON_DEFS[id];
    
    const inv = this.inventory[id];
    this.magCapacity = this.config.magSize;
    this.ammo = inv.ammo;
    this.totalAmmo = inv.total;
    this.fireRate = 60 / this.config.rpm;
    this.fireMode = inv.mode;
    
    this.isReloading = false;
    this.isInspecting = false;
    
    this.viewmodel.play('draw');
    this.sfx.playFootstep('concrete', 'jump'); // Simulate draw rustle
  }

  cycleFireMode() {
    const modes = this.config.modes;
    if (!modes || modes.length <= 1) return;
    const currentIdx = modes.indexOf(this.fireMode);
    const nextIdx = (currentIdx + 1) % modes.length;
    this.fireMode = modes[nextIdx];
  }

  inspect() {
    if (this.isReloading || this.isAiming || this.isInspecting) return;
    this.isInspecting = true;
    this.viewmodel.play('inspect');
  }

  setAiming(isAiming) {
    this.isAiming = isAiming;
    if (isAiming) {
      this.isInspecting = false;
      this.viewmodel.stopClip();
    }
  }

  canFire() {
    return this.ammo > 0 && !this.isReloading && this.fireTimer <= 0 && !this.viewmodel.clipPlaying;
  }

  fire(enemies, arenaColliders, playerPos) {
    if (this.isReloading || this.fireTimer > 0) return { hit: false };

    if (this.ammo <= 0) {
      this.sfx.playEmptyClick();
      this.fireTimer = 60 / this.config.rpm;
      return { hit: false };
    }

    this.ammo--;
    this.fireTimer = 60 / this.config.rpm;
    
    if (this.events) this.events.emit('weapon:fire', { recoil: this.config.recoil?.punch || 1 });
    
    this.sfx.playGunshot(true, null, this.config.id === 'rifle' ? 'rifle' : this.config.id === 'smg' ? 'smg' : 'pistol');
    
    // Viewmodel procedural recoil
    this.viewmodel.addRecoil(this.config.recoil.pitch, this.config.recoil.yaw, false);
    
    const spreadAngle = this.isAiming ? this.config.spreadAds * (Math.PI / 180) : this.config.spreadHip * (Math.PI / 180);
    const screenCoord = new THREE.Vector2(
      (Math.random() - 0.5) * spreadAngle,
      (Math.random() - 0.5) * spreadAngle
    );

    this.raycaster.setFromCamera(screenCoord, this.camera);
    
    const muzzlePos = this.viewmodel.muzzleWorld(new THREE.Vector3());
    const ejectPos = this.viewmodel.ejectWorld(new THREE.Vector3());
    const ejectVel = this.viewmodel.ejectVelocity(new THREE.Vector3(), 2.3 + Math.random() * 1.2);
    ejectVel.y += 1.1;
    this.sfx.playShellDrop(ejectPos, 'concrete');
    
    if (this.fx) {
      this.fx.spawnShell(ejectPos, ejectVel, { caseLen: this.config.recoil?.caseLen || 0.0446, rimR: this.config.recoil?.rimR || 0.00495 });
    }

    const shootableObjects = [];
    const enemyMeshMap = new Map();
    enemies.forEach((enemy) => {
      if (enemy.isAlive) {
        shootableObjects.push(enemy.mesh);
        enemyMeshMap.set(enemy.mesh.id, enemy);
      }
    });
    arenaColliders.forEach((c) => shootableObjects.push(c.mesh));

    const intersects = this.raycaster.intersectObjects(shootableObjects, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitPoint = hit.point;
      // Tracer removed as per user request
      
      let hitRoot = hit.object;
      while (hitRoot.parent && !enemyMeshMap.has(hitRoot.id) && hitRoot.parent.type === 'Group') {
        hitRoot = hitRoot.parent;
      }

      const enemy = enemyMeshMap.get(hitRoot.id) || enemyMeshMap.get(hit.object.id);
      if (enemy) {
        const isHeadshot = hitPoint.y > (enemy.mesh.position.y + 1.25);
        const damageDealt = isHeadshot ? this.config.damage * 2.2 : this.config.damage;
        enemy.takeDamage(damageDealt);
        this.sfx.playHitmarker(isHeadshot);
        this.sfx.playImpact(hitPoint, 'flesh', 1.0);
        if (this.events) {
          this.events.emit('damage:dealt', {
            target: enemy,
            amount: damageDealt,
            headshot: isHeadshot,
            killed: enemy.health <= 0,
            point: hitPoint
          });
        }
        return { hit: true, enemy, damage: damageDealt, isHeadshot };
      } else {
        this.sfx.playImpact(hitPoint, 'metal', 0.9);
        if (this.fx) {
           this.fx.addDecal(hitPoint, hit.normal, { size: 0.15, opacity: 0.9 });
        }
      }
    } else {
      const endPoint = muzzlePos.clone().add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(this.config.maxRange));
      // Tracer removed as per user request
    }
    
    if (this.fx) {
      const boreDir = this.viewmodel.boreDir(new THREE.Vector3());
      this.fx.muzzleFlash({
        position: muzzlePos,
        direction: boreDir,
        weapon: this.activeId,
        view: false
      });
    }

    return { hit: false };
  }

  reload() {
    if (this.isReloading || this.ammo >= this.magCapacity || this.totalAmmo <= 0) return;
    this.isReloading = true;
    this.isInspecting = false;
    this.reloadStartTime = performance.now();
    
    this.viewmodel.play(this.ammo > 0 ? 'reloadTac' : 'reloadEmpty');
    if (this.events) this.events.emit('weapon:reload', { phase: 'start' });
  }

  handleClipEvent(eventName, clipName) {
    if (!this.sfx) return;
    switch(eventName) {
      case 'magout':
        if (this.sfx.playMagOut) this.sfx.playMagOut();
        break;
      case 'magdrop':
        break;
      case 'magin':
        if (this.sfx.playMagIn) this.sfx.playMagIn();
        break;
      case 'slap':
        if (this.sfx.playMagSlap) this.sfx.playMagSlap();
        break;
    }
  }

  update(dt, isMoving, isSSprint) {
    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }

    // Since we track isReloading state, check if the viewmodel finished the reload clip
    if (this.isReloading && !this.viewmodel.clipPlaying) {
      const needed = this.magCapacity - this.ammo;
      const available = Math.min(needed, this.totalAmmo);
      this.ammo += available;
      this.totalAmmo -= available;
      this.isReloading = false;
      if (this.events) this.events.emit('weapon:reload', { phase: 'end' });
    }

    if (this.isInspecting && !this.viewmodel.clipPlaying) {
      this.isInspecting = false;
    }

    const state = {
      ads: this.isAiming ? 1.0 : 0.0,
      sprint: isSSprint && !this.isAiming && !this.isReloading && !this.isInspecting ? 1.0 : 0.0,
      lowReady: 0.0,
      speed: isMoving ? (isSSprint ? 5.5 : 3.0) : 0,
      crouch: 0.0,
      airborne: 0.0, 
      trigger: this.fireTimer > 0 ? 1.0 : 0.0,
      empty: this.ammo === 0,
      cycleTime: 60 / this.config.rpm
    };

    this.viewmodel.update(dt, state);
  }

  getHudState() {
    return {
      name: this.config.label || this.activeId,
      mode: 'AUTO',
      ammo: this.ammo,
      reserve: this.totalAmmo,
      magSize: this.magCapacity,
      reloading: this.isReloading,
      reloadProgress: this.isReloading ? Math.min(1, (performance.now() - (this.reloadStartTime || performance.now())) / 2000) : 0,
      ads: this.viewmodel?.ads > 0,
      lethalCount: 2,
      tacticalCount: 1,
      spread: this.isAiming ? 1.0 : 4.0
    };
  }
}
