/**
 * Enemy.js
 * Tactical Enemy AI Bot with procedural 3D model, finite state machine,
 * pathing, line-of-sight tracking, weapon firing, and rewind interpolation.
 */
import * as THREE from 'three';

export class Enemy {
  constructor(scene, arena, soundEffects, particleSystem, initialPosition) {
    this.scene = scene;
    this.arena = arena;
    this.sfx = soundEffects;
    this.particles = particleSystem;

    this.maxHealth = 100;
    this.health = 100;
    this.isAlive = true;
    this.speed = 3.8;

    // AI FSM States: 'patrol', 'chase', 'attack', 'cover'
    this.state = 'patrol';
    this.patrolTarget = new THREE.Vector3();
    this.stateTimer = 0;
    this.fireTimer = 0;
    this.fireInterval = 0.22;
    this.burstCount = 0;
    this.burstLimit = 3;

    this.buildModel(initialPosition);
    this.pickNewPatrolTarget();
  }

  buildModel(pos) {
    this.mesh = new THREE.Group();

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.5,
      metalness: 0.6,
    });

    const visorMat = new THREE.MeshBasicMaterial({
      color: 0xff0044,
    });

    // Torso / Vest
    const torsoGeo = new THREE.BoxGeometry(0.6, 0.75, 0.35);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Helmet & Red Tactical Visor
    const headGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, armorMat);
    head.position.y = 1.65;
    head.castShadow = true;
    this.mesh.add(head);

    const visorGeo = new THREE.BoxGeometry(0.28, 0.08, 0.05);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.65, -0.18);
    this.mesh.add(visor);

    // Weapon
    const gunGeo = new THREE.BoxGeometry(0.08, 0.1, 0.5);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.3, metalness: 0.9 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.3, 1.0, -0.3);
    gun.castShadow = true;
    this.mesh.add(gun);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
    const leftLeg = new THREE.Mesh(legGeo, armorMat);
    leftLeg.position.set(-0.16, 0.38, 0);
    leftLeg.castShadow = true;
    this.mesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, armorMat);
    rightLeg.position.set(0.16, 0.38, 0);
    rightLeg.castShadow = true;
    this.mesh.add(rightLeg);

    this.mesh.position.copy(pos);
    this.scene.add(this.mesh);
  }

  pickNewPatrolTarget() {
    const idx = Math.floor(Math.random() * this.arena.spawnPoints.length);
    this.patrolTarget.copy(this.arena.spawnPoints[idx]);
    this.stateTimer = 4 + Math.random() * 4;
  }

  takeDamage(amount, isHeadshot = false) {
    if (!this.isAlive) return;

    this.health = Math.max(0, this.health - amount);
    this.state = 'attack';
    this.sfx.playEnemyBark('hurt', this.mesh.position);

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.isAlive = false;
    this.mesh.visible = false;
    this.sfx.playEnemyBark('death', this.mesh.position);
    this.particles.emitSparks(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, 1, 0), 20, 0xff0044);
  }

  update(dt, player, timeScale) {
    if (!this.isAlive) return;

    const scaledDt = dt * timeScale;
    const toPlayer = new THREE.Vector3().subVectors(player.position, this.mesh.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    // Check line of sight
    const hasSight = distanceToPlayer < 28;

    // FSM State Updates (Passive practice target mode for development)
    this.stateTimer -= scaledDt;
    if (this.stateTimer <= 0) {
      this.pickNewPatrolTarget();
    }

    // Patrol towards patrolTarget
    const toTarget = new THREE.Vector3().subVectors(this.patrolTarget, this.mesh.position);
    toTarget.y = 0;
    if (toTarget.length() < 1.5) {
      this.pickNewPatrolTarget();
    } else {
      toTarget.normalize();
      const moveVec = toTarget.multiplyScalar((this.speed * 0.4) * scaledDt);
      const nextPos = this.mesh.position.clone().add(moveVec);
      if (!this.arena.checkCollision(nextPos, 0.5)) {
        this.mesh.position.copy(nextPos);
      }
      this.mesh.rotation.y = Math.atan2(toTarget.x, toTarget.z) + Math.PI;
    }
  }

  fireAtPlayer(player) {
    // Disabled during development so player can develop in peace
    return;
  }

  applyRewindState(state) {
    this.isAlive = state.active;
    this.mesh.visible = state.active;
    this.mesh.position.set(state.x, state.y, state.z);
    this.mesh.rotation.y = state.yaw;
    this.health = state.health;
  }

  respawn(pos) {
    this.mesh.position.copy(pos);
    this.health = this.maxHealth;
    this.isAlive = true;
    this.mesh.visible = true;
    this.state = 'patrol';
    this.pickNewPatrolTarget();
  }
}
