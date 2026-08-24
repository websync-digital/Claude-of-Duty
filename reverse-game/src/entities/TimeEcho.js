/**
 * TimeEcho.js
 * Holographic paradox ghost entity that replays historical player trajectories
 * and assists the player in combat after a temporal rewind.
 */
import * as THREE from 'three';
import { createTimeEchoMaterial } from '../world/Shaders.js';

export class TimeEcho {
  constructor(scene, soundEffects, particleSystem) {
    this.scene = scene;
    this.sfx = soundEffects;
    this.particles = particleSystem;

    this.active = false;
    this.historyPath = [];
    this.pathIndex = 0;
    this.lifetime = 6.0; // 6 seconds active
    this.age = 0;
    this.fireTimer = 0;

    this.buildGhostMesh();
  }

  buildGhostMesh() {
    this.mesh = new THREE.Group();
    this.material = createTimeEchoMaterial();

    // Body Capsule / Box
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 12);
    const body = new THREE.Mesh(bodyGeo, this.material);
    body.position.y = 0.9;
    this.mesh.add(body);

    // Head Sphere
    const headGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const head = new THREE.Mesh(headGeo, this.material);
    head.position.y = 1.8;
    this.mesh.add(head);

    // Weapon representation
    const gunGeo = new THREE.BoxGeometry(0.08, 0.12, 0.45);
    const gun = new THREE.Mesh(gunGeo, this.material);
    gun.position.set(0.25, 1.1, -0.3);
    this.mesh.add(gun);

    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  spawn(historyPath) {
    if (!historyPath || historyPath.length < 5) return;
    this.historyPath = [...historyPath].reverse(); // Play forward from oldest snapshot
    this.pathIndex = 0;
    this.age = 0;
    this.active = true;
    this.mesh.visible = true;

    const start = this.historyPath[0];
    this.mesh.position.set(start.x, start.y - 0.8, start.z);
    this.mesh.rotation.y = start.yaw;
  }

  update(dt, enemies) {
    if (!this.active) return;

    this.age += dt;
    this.material.uniforms.uTime.value = performance.now() * 0.001;

    if (this.age >= this.lifetime || this.pathIndex >= this.historyPath.length - 1) {
      this.despawn();
      return;
    }

    // Step along historical trajectory
    const current = this.historyPath[this.pathIndex];
    this.pathIndex++;

    if (current) {
      this.mesh.position.set(current.x, current.y - 0.8, current.z);
      this.mesh.rotation.y = current.yaw;
    }

    // Automated Echo firing at nearest enemy
    this.fireTimer += dt;
    if (this.fireTimer >= 0.25) {
      this.fireTimer = 0;
      this.attackNearestEnemy(enemies);
    }
  }

  attackNearestEnemy(enemies) {
    let nearest = null;
    let minDist = 25;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isAlive) {
        const dist = this.mesh.position.distanceTo(e.mesh.position);
        if (dist < minDist) {
          minDist = dist;
          nearest = e;
        }
      }
    }

    if (nearest) {
      const muzzlePos = this.mesh.position.clone().add(new THREE.Vector3(0.25, 1.1, -0.3));
      const targetPos = nearest.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.particles.emitTracer(muzzlePos, targetPos, false);
      this.particles.emitSparks(targetPos, new THREE.Vector3(0, 1, 0), 4, 0x00f0ff);
      nearest.takeDamage(18, false);
      this.sfx.playGunshot(true);
    }
  }

  despawn() {
    this.active = false;
    this.mesh.visible = false;
    this.historyPath = [];
  }
}
