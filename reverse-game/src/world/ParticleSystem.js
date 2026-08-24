/**
 * ParticleSystem.js
 * Object-pooled GPU particle system for sparks, muzzle flashes, and temporal reverse vortexes.
 * Zero-GC allocation in hot loops.
 */
import * as THREE from 'three';

const MAX_SPARKS = 200;
const MAX_TRACERS = 50;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;

    // Sparks Pool
    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(MAX_SPARKS * 3);
    this.sparkVelocities = new Float32Array(MAX_SPARKS * 3);
    this.sparkAges = new Float32Array(MAX_SPARKS);
    this.sparkLifetimes = new Float32Array(MAX_SPARKS);
    this.sparkActive = new Uint8Array(MAX_SPARKS);

    this.sparkGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.sparkPositions, 3)
    );

    this.sparkMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.15,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.sparkPoints = new THREE.Points(this.sparkGeometry, this.sparkMaterial);
    this.scene.add(this.sparkPoints);

    // Tracers Pool
    this.tracers = [];
    const tracerMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });

    for (let i = 0; i < MAX_TRACERS; i++) {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(6);
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geom, tracerMaterial);
      line.visible = false;
      this.scene.add(line);
      this.tracers.push({
        line,
        geom,
        active: false,
        age: 0,
        lifetime: 0.08,
        isReverse: false,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
      });
    }

    // Temporal Distortion Vortex Mesh (for Rewind and Anomaly Points)
    const vortexGeom = new THREE.RingGeometry(0.5, 2.5, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.vortex = new THREE.Mesh(vortexGeom, vortexMat);
    this.vortex.rotation.x = Math.PI / 2;
    this.vortex.visible = false;
    this.scene.add(this.vortex);
  }

  emitSparks(position, normal, count = 8, color = 0xffaa00) {
    let emitted = 0;
    for (let i = 0; i < MAX_SPARKS && emitted < count; i++) {
      if (!this.sparkActive[i]) {
        this.sparkActive[i] = 1;
        this.sparkAges[i] = 0;
        this.sparkLifetimes[i] = 0.2 + Math.random() * 0.25;

        const idx = i * 3;
        this.sparkPositions[idx] = position.x;
        this.sparkPositions[idx + 1] = position.y;
        this.sparkPositions[idx + 2] = position.z;

        // Velocity scattered along normal
        const spread = 0.8;
        this.sparkVelocities[idx] = (normal.x + (Math.random() - 0.5) * spread) * (4 + Math.random() * 4);
        this.sparkVelocities[idx + 1] = (normal.y + (Math.random() - 0.5) * spread + 0.3) * (4 + Math.random() * 4);
        this.sparkVelocities[idx + 2] = (normal.z + (Math.random() - 0.5) * spread) * (4 + Math.random() * 4);

        emitted++;
      }
    }
  }

  emitTracer(start, end, isReverse = false) {
    for (let i = 0; i < MAX_TRACERS; i++) {
      const t = this.tracers[i];
      if (!t.active) {
        t.active = true;
        t.age = 0;
        t.isReverse = isReverse;
        t.start.copy(start);
        t.end.copy(end);
        t.line.visible = true;

        const pos = t.geom.attributes.position.array;
        pos[0] = start.x;
        pos[1] = start.y;
        pos[2] = start.z;
        pos[3] = end.x;
        pos[4] = end.y;
        pos[5] = end.z;
        t.geom.attributes.position.needsUpdate = true;
        break;
      }
    }
  }

  showTemporalVortex(position, active = true) {
    if (active) {
      this.vortex.position.copy(position);
      this.vortex.position.y = 0.1;
      this.vortex.visible = true;
      this.vortex.material.opacity = 0.7;
    } else {
      this.vortex.visible = false;
      this.vortex.material.opacity = 0;
    }
  }

  update(dt, timeScale = 1.0, isRewinding = false) {
    // Update Sparks
    let anyActive = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.sparkActive[i]) {
        anyActive = true;
        this.sparkAges[i] += dt;

        if (this.sparkAges[i] >= this.sparkLifetimes[i]) {
          this.sparkActive[i] = 0;
          this.sparkPositions[i * 3 + 1] = -9999;
          continue;
        }

        const idx = i * 3;
        const speedFactor = isRewinding ? -1.5 : timeScale;
        this.sparkPositions[idx] += this.sparkVelocities[idx] * dt * speedFactor;
        this.sparkPositions[idx + 1] += this.sparkVelocities[idx + 1] * dt * speedFactor - (isRewinding ? -9.8 : 9.8) * dt * dt;
        this.sparkPositions[idx + 2] += this.sparkVelocities[idx + 2] * dt * speedFactor;
      }
    }
    if (anyActive) {
      this.sparkGeometry.attributes.position.needsUpdate = true;
    }

    // Update Tracers
    for (let i = 0; i < MAX_TRACERS; i++) {
      const t = this.tracers[i];
      if (t.active) {
        t.age += dt;
        if (t.age >= t.lifetime) {
          t.active = false;
          t.line.visible = false;
        }
      }
    }

    // Update Vortex Spin
    if (this.vortex.visible) {
      this.vortex.rotation.z += (isRewinding ? -8 : 4) * dt;
    }
  }
}
