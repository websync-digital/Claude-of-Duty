/**
 * Arena.js
 * Tactical combat arena with modular cover, catwalks, temporal pylons, and collision bounding boxes.
 */
import * as THREE from 'three';

export class Arena {
  constructor(scene, textureGen) {
    this.scene = scene;
    this.textureGen = textureGen;
    this.colliders = []; // AABB boxes for physics & bullet collision
    this.spawnPoints = [
      new THREE.Vector3(0, 1.6, 18),
      new THREE.Vector3(-14, 1.6, -14),
      new THREE.Vector3(14, 1.6, -14),
      new THREE.Vector3(-18, 1.6, 8),
      new THREE.Vector3(18, 1.6, 8),
      new THREE.Vector3(0, 1.6, -20),
    ];

    this.init();
  }

  init() {
    this.createMaterials();
    this.buildFloorAndCeiling();
    this.buildPerimeterWalls();
    this.buildObstaclesAndCover();
    this.buildTemporalPylons();
    this.setupLighting();
  }

  createMaterials() {
    const floorTex = this.textureGen.createFloorTexture();
    const wallTex = this.textureGen.createWallTexture();

    this.floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.6,
      metalness: 0.4,
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.5,
      metalness: 0.6,
    });

    this.coverMaterial = new THREE.MeshStandardMaterial({
      color: 0x333a44,
      roughness: 0.4,
      metalness: 0.8,
    });

    this.pylonMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.9,
    });
  }

  buildFloorAndCeiling() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floor = new THREE.Mesh(floorGeo, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildPerimeterWalls() {
    const wallHeight = 10;
    const arenaSize = 50;

    const configs = [
      { size: [arenaSize, wallHeight, 1], pos: [0, wallHeight / 2, -arenaSize / 2] },
      { size: [arenaSize, wallHeight, 1], pos: [0, wallHeight / 2, arenaSize / 2] },
      { size: [1, wallHeight, arenaSize], pos: [-arenaSize / 2, wallHeight / 2, 0] },
      { size: [1, wallHeight, arenaSize], pos: [arenaSize / 2, wallHeight / 2, 0] },
    ];

    configs.forEach((cfg) => {
      const geo = new THREE.BoxGeometry(...cfg.size);
      const mesh = new THREE.Mesh(geo, this.wallMaterial);
      mesh.position.set(...cfg.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ mesh, box, type: 'wall' });
    });
  }

  buildObstaclesAndCover() {
    const obstacles = [
      // Central bunker pillars
      { size: [3, 6, 3], pos: [-6, 3, -6] },
      { size: [3, 6, 3], pos: [6, 3, -6] },
      { size: [3, 6, 3], pos: [-6, 3, 6] },
      { size: [3, 6, 3], pos: [6, 3, 6] },

      // Tactical low waist-high barricades
      { size: [6, 1.4, 1], pos: [0, 0.7, 8] },
      { size: [6, 1.4, 1], pos: [0, 0.7, -8] },
      { size: [1, 1.4, 8], pos: [-12, 0.7, 0] },
      { size: [1, 1.4, 8], pos: [12, 0.7, 0] },

      // High defense crates
      { size: [2.5, 2.5, 2.5], pos: [-15, 1.25, -12] },
      { size: [2.5, 2.5, 2.5], pos: [15, 1.25, -12] },
      { size: [2.5, 2.5, 2.5], pos: [-15, 1.25, 12] },
      { size: [2.5, 2.5, 2.5], pos: [15, 1.25, 12] },

      // Elevated catwalk bridge
      { size: [16, 0.5, 4], pos: [0, 3.5, 0] },
    ];

    obstacles.forEach((obs) => {
      const geo = new THREE.BoxGeometry(...obs.size);
      const mesh = new THREE.Mesh(geo, this.coverMaterial);
      mesh.position.set(...obs.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ mesh, box, type: 'cover' });
    });
  }

  buildTemporalPylons() {
    const pylonPositions = [
      [-18, 0, -18],
      [18, 0, -18],
      [-18, 0, 18],
      [18, 0, 18],
    ];

    pylonPositions.forEach(([x, y, z]) => {
      const geo = new THREE.CylinderGeometry(0.6, 0.9, 6, 8);
      const mesh = new THREE.Mesh(geo, this.pylonMaterial);
      mesh.position.set(x, 3, z);
      mesh.castShadow = true;
      this.scene.add(mesh);

      // Emissive core ring
      const ringGeo = new THREE.TorusGeometry(1.1, 0.1, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 4.5, z);
      this.scene.add(ring);

      const box = new THREE.Box3().setFromObject(mesh);
      this.colliders.push({ mesh, box, type: 'pylon' });
    });
  }

  setupLighting() {
    // Cyan tactical accent point lights
    const p1 = new THREE.PointLight(0x00f0ff, 2, 20);
    p1.position.set(0, 5, 0);
    this.scene.add(p1);

    const p2 = new THREE.PointLight(0xffaa00, 1.5, 15);
    p2.position.set(0, 2, -15);
    this.scene.add(p2);
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
