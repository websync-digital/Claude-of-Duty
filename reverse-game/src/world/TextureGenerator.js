/**
 * TextureGenerator.js
 * Generates crisp tactical canvas textures and normal maps procedurally.
 * High-performance, zero network overhead, cached Three.js CanvasTextures.
 */
import * as THREE from 'three';

export class TextureGenerator {
  constructor() {
    this.cache = new Map();
  }

  createFloorTexture(size = 512) {
    if (this.cache.has('floor')) return this.cache.get('floor');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base concrete dark tone
    ctx.fillStyle = '#181b20';
    ctx.fillRect(0, 0, size, size);

    // Grid panels
    const tileSize = size / 8;
    ctx.strokeStyle = '#0d0f12';
    ctx.lineWidth = 3;

    for (let x = 0; x <= size; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // High-tech rivet dots & scuffs
    ctx.fillStyle = '#2d333b';
    for (let x = tileSize / 2; x < size; x += tileSize) {
      for (let y = tileSize / 2; y < size; y += tileSize) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }

    // Noise speckles
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    this.cache.set('floor', texture);
    return texture;
  }

  createWallTexture(size = 512) {
    if (this.cache.has('wall')) return this.cache.get('wall');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Tactical gunmetal base
    ctx.fillStyle = '#222831';
    ctx.fillRect(0, 0, size, size);

    // Metal panelling seams
    ctx.fillStyle = '#161a20';
    ctx.fillRect(0, 0, size, 12);
    ctx.fillRect(0, size - 12, size, 12);
    ctx.fillRect(0, size / 2 - 4, size, 8);

    // Hazard stripes section
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(16, size / 2 - 24, size - 32, 6);

    ctx.fillStyle = '#111827';
    for (let x = 16; x < size - 32; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, size / 2 - 24);
      ctx.lineTo(x + 8, size / 2 - 18);
      ctx.lineTo(x + 4, size / 2 - 18);
      ctx.lineTo(x - 4, size / 2 - 24);
      ctx.fill();
    }

    // Micro-grunge noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grain = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + grain));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('wall', texture);
    return texture;
  }

  createWeaponTexture(size = 256) {
    if (this.cache.has('weapon')) return this.cache.get('weapon');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Matte carbon polymer
    ctx.fillStyle = '#1a1e24';
    ctx.fillRect(0, 0, size, size);

    // Carbon weave pattern
    ctx.fillStyle = '#282f38';
    for (let x = 0; x < size; x += 8) {
      for (let y = 0; y < size; y += 8) {
        if ((x / 8 + y / 8) % 2 === 0) {
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Emissive tactical engraving
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(size - 32, 20, 24, 3);

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set('weapon', texture);
    return texture;
  }

  createHologramTexture(size = 128) {
    if (this.cache.has('hologram')) return this.cache.get('hologram');

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    for (let y = 0; y < size; y += 4) {
      ctx.fillRect(0, y, size, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.cache.set('hologram', texture);
    return texture;
  }
}
