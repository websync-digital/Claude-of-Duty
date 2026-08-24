/**
 * StateBuffer.js
 * High-performance Zero-GC circular state snapshot buffer for time-rewind mechanics.
 * Pre-allocated typed arrays (Float32Array) storing 5-10s of 50Hz state history.
 */

export class StateBuffer {
  constructor(maxSnapshots = 400) {
    // 400 snapshots @ 50Hz = 8 seconds of history
    this.maxSnapshots = maxSnapshots;
    this.currentIndex = 0;
    this.count = 0;

    // Player Buffer: [posX, posY, posZ, yaw, pitch, health, ammo]
    this.playerBuffer = new Float32Array(maxSnapshots * 7);

    // Enemies Buffer (up to 10 bots): [active, posX, posY, posZ, yaw, health] * 10
    this.maxEnemies = 10;
    this.enemyBuffer = new Float32Array(maxSnapshots * this.maxEnemies * 6);
  }

  recordSnapshot(player, enemies) {
    const pIdx = this.currentIndex * 7;
    this.playerBuffer[pIdx] = player.position.x;
    this.playerBuffer[pIdx + 1] = player.position.y;
    this.playerBuffer[pIdx + 2] = player.position.z;
    this.playerBuffer[pIdx + 3] = player.yaw;
    this.playerBuffer[pIdx + 4] = player.pitch;
    this.playerBuffer[pIdx + 5] = player.health;
    this.playerBuffer[pIdx + 6] = player.weapon.ammo;

    const eBase = this.currentIndex * (this.maxEnemies * 6);
    for (let i = 0; i < this.maxEnemies; i++) {
      const eIdx = eBase + i * 6;
      if (i < enemies.length && enemies[i].isAlive) {
        const enemy = enemies[i];
        this.enemyBuffer[eIdx] = 1.0;
        this.enemyBuffer[eIdx + 1] = enemy.mesh.position.x;
        this.enemyBuffer[eIdx + 2] = enemy.mesh.position.y;
        this.enemyBuffer[eIdx + 3] = enemy.mesh.position.z;
        this.enemyBuffer[eIdx + 4] = enemy.mesh.rotation.y;
        this.enemyBuffer[eIdx + 5] = enemy.health;
      } else {
        this.enemyBuffer[eIdx] = 0.0;
      }
    }

    this.currentIndex = (this.currentIndex + 1) % this.maxSnapshots;
    if (this.count < this.maxSnapshots) {
      this.count++;
    }
  }

  getRewindState(stepsBack, targetPlayerState, targetEnemyStates) {
    if (this.count === 0) return false;

    const steps = Math.min(stepsBack, this.count - 1);
    let index = (this.currentIndex - 1 - steps) % this.maxSnapshots;
    if (index < 0) index += this.maxSnapshots;

    const pIdx = index * 7;
    targetPlayerState.x = this.playerBuffer[pIdx];
    targetPlayerState.y = this.playerBuffer[pIdx + 1];
    targetPlayerState.z = this.playerBuffer[pIdx + 2];
    targetPlayerState.yaw = this.playerBuffer[pIdx + 3];
    targetPlayerState.pitch = this.playerBuffer[pIdx + 4];
    targetPlayerState.health = this.playerBuffer[pIdx + 5];
    targetPlayerState.ammo = this.playerBuffer[pIdx + 6];

    const eBase = index * (this.maxEnemies * 6);
    for (let i = 0; i < this.maxEnemies; i++) {
      const eIdx = eBase + i * 6;
      targetEnemyStates[i] = {
        active: this.enemyBuffer[eIdx] > 0.5,
        x: this.enemyBuffer[eIdx + 1],
        y: this.enemyBuffer[eIdx + 2],
        z: this.enemyBuffer[eIdx + 3],
        yaw: this.enemyBuffer[eIdx + 4],
        health: this.enemyBuffer[eIdx + 5],
      };
    }

    return true;
  }

  getHistoricalPath(stepsCount = 150) {
    const count = Math.min(stepsCount, this.count);
    const path = [];
    for (let i = 0; i < count; i++) {
      let index = (this.currentIndex - 1 - i) % this.maxSnapshots;
      if (index < 0) index += this.maxSnapshots;
      const pIdx = index * 7;
      path.push({
        x: this.playerBuffer[pIdx],
        y: this.playerBuffer[pIdx + 1],
        z: this.playerBuffer[pIdx + 2],
        yaw: this.playerBuffer[pIdx + 3],
        pitch: this.playerBuffer[pIdx + 4],
      });
    }
    return path;
  }

  reset() {
    this.currentIndex = 0;
    this.count = 0;
    this.playerBuffer.fill(0);
    this.enemyBuffer.fill(0);
  }
}
