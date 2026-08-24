/**
 * OpenWorld.js
 * Vast open-world terrain: rolling hills, scattered rocks, dirt paths, no walls.
 * Replaces the enclosed Arena with a 600m x 600m playable landscape.
 */
import * as THREE from 'three';

// Simple deterministic noise for terrain height
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return (
    hash(ix, iz) * (1 - ux) * (1 - uz) +
    hash(ix + 1, iz) * ux * (1 - uz) +
    hash(ix, iz + 1) * (1 - ux) * uz +
    hash(ix + 1, iz + 1) * ux * uz
  );
}

function terrainHeight(x, z) {
  // Multi-octave FBM for natural rolling hills
  let h = 0;
  h += smoothNoise(x * 0.008, z * 0.008) * 4.5;   // Large sweeping hills
  h += smoothNoise(x * 0.025, z * 0.025) * 1.8;   // Medium undulations
  h += smoothNoise(x * 0.07,  z * 0.07)  * 0.6;   // Small surface detail
  h += smoothNoise(x * 0.2,   z * 0.2)   * 0.15;  // Fine micro-relief
  // Flatten the central spawn area
  const d = Math.sqrt(x * x + z * z);
  const flatBlend = Math.max(0, 1 - d / 18);
  h = h * (1 - flatBlend * 0.9);
  return h;
}

export class OpenWorld {
  constructor(scene, textureGen) {
    this.scene = scene;
    this.textureGen = textureGen;
    this.colliders = [];

    // Open world spawn points spread across the terrain
    this.spawnPoints = [
      new THREE.Vector3(0,   terrainHeight(0, 0)   + 1.7, 0),
      new THREE.Vector3(30,  terrainHeight(30, -20) + 1.7, -20),
      new THREE.Vector3(-30, terrainHeight(-30, 20) + 1.7, 20),
      new THREE.Vector3(50,  terrainHeight(50, 50)  + 1.7, 50),
      new THREE.Vector3(-50, terrainHeight(-50, -40)+ 1.7, -40),
      new THREE.Vector3(0,   terrainHeight(0, -60)  + 1.7, -60),
    ];

    this._heightCache = new Map();
    this.init();
  }

  init() {
    this._buildTerrain();
    this._buildRocks();
    this._buildDistantMountains();
    this._setupLighting();
  }

  _buildTerrain() {
    const SIZE = 600;
    const SEGS = 160; // enough resolution for smooth rolling hills

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
    }
    geo.computeVertexNormals();

    // Terrain colour: earthy green/brown mix via vertex colors
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i);
      // Blend from sandy-brown at low to grassy-green at mid to rocky-grey at high
      const t = Math.max(0, Math.min(1, (h + 0.5) / 6));
      const r = 0.36 + t * 0.08;
      const g = 0.32 + t * 0.22;
      const b = 0.18 + t * 0.04;
      colors[i * 3]     = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.3,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.name = 'terrain';
    this.scene.add(this.terrainMesh);
  }

  _buildRocks() {
    // Procedurally scatter ~80 rocks across the landscape
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x7a7468,
      roughness: 0.85,
      metalness: 0.05,
    });

    const rng = (seed) => {
      const s = Math.sin(seed * 9301 + 49297) * 233280;
      return s - Math.floor(s);
    };

    for (let i = 0; i < 80; i++) {
      const angle = rng(i * 3.1) * Math.PI * 2;
      const radius = 15 + rng(i * 7.3) * 220;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = terrainHeight(x, z);

      const scale = 0.4 + rng(i * 2.7) * 2.2;
      const rx = rng(i * 5.1) * Math.PI;
      const ry = rng(i * 4.4) * Math.PI;

      // Use scaled box with slight random shape for natural variety
      const geo = new THREE.DodecahedronGeometry(scale, 0);
      // Distort vertices slightly for organic look
      const verts = geo.attributes.position;
      for (let v = 0; v < verts.count; v++) {
        const jx = (rng(v * 13 + i) - 0.5) * 0.3 * scale;
        const jy = (rng(v * 17 + i) - 0.5) * 0.3 * scale;
        const jz = (rng(v * 19 + i) - 0.5) * 0.3 * scale;
        verts.setXYZ(v, verts.getX(v) + jx, verts.getY(v) + jy, verts.getZ(v) + jz);
      }
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, rockMat);
      mesh.position.set(x, y + scale * 0.4, z);
      mesh.rotation.set(rx, ry, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Add collision box for larger rocks
      if (scale > 1.0) {
        const box = new THREE.Box3().setFromObject(mesh);
        this.colliders.push({ mesh, box, type: 'rock' });
      }
    }
  }

  _buildDistantMountains() {
    // Low-poly mountain silhouettes on the horizon
    const mtnMat = new THREE.MeshStandardMaterial({
      color: 0x6a7a8a,
      roughness: 1.0,
      metalness: 0.0,
      fog: true,
    });

    const peaks = [
      [260, 0, -260], [-280, 0, -240], [240, 0, 270], [-260, 0, 260],
      [0, 0, -290], [290, 0, 0], [-290, 0, 0], [0, 0, 290],
    ];

    peaks.forEach(([x, , z], i) => {
      const h = 20 + Math.sin(i * 2.7) * 12;
      const radius = 30 + Math.cos(i * 1.9) * 15;
      const geo = new THREE.ConeGeometry(radius, h, 7 + (i % 3));
      const mesh = new THREE.Mesh(geo, mtnMat);
      mesh.position.set(x, terrainHeight(x, z) + h * 0.5, z);
      mesh.rotation.y = i * 1.1;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
    });
  }

  _setupLighting() {
    // Fog for depth — light blue atmosphere matching daytime sky
    this.scene.fog = new THREE.Fog(0xc8dcf0, 80, 400);
  }

  /** Return analytic terrain height at world (x, z) */
  groundHeight(x, z) {
    return terrainHeight(x, z);
  }

  checkCollision(position, radius = 0.4) {
    const playerSphere = new THREE.Sphere(position, radius);
    for (let i = 0; i < this.colliders.length; i++) {
      if (this.colliders[i].box.intersectsSphere(playerSphere)) {
        return true;
      }
    }
    return false;
  }
}
