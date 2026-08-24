/**
 * Sky.js
 * Atmospheric scattering sky dome, dynamic celestial sun lighting,
 * and procedural cloud decks for Reverse Game.
 */
import * as THREE from 'three';

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.timeOfDay = 12.0; // Bright midday
    this.sunPosition = new THREE.Vector3();
    this.sunColor = new THREE.Color(0xffffff);
    this.ambientColor = new THREE.Color(0x9ec4e0);

    this.initSkyDome();
    this.initCelestialLighting();
    this.updateSunPosition();
  }

  initSkyDome() {
    // Large hemisphere dome for full-horizon immersion
    const domeGeo = new THREE.SphereGeometry(80, 32, 24);

    this.skyUniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 },
      uZenithColor: { value: new THREE.Color(0x1e6ab0) },  // deep sky blue
      uHorizonColor: { value: new THREE.Color(0x8ec8f0) }, // pale horizon haze
      uSunColor: { value: new THREE.Color(0xffffff) },
      uGroundColor: { value: new THREE.Color(0x6a8060) },  // terrain green seen from below
      uSunDiscSize: { value: 0.038 },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vRayDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vRayDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uGroundColor;
        uniform float uSunDiscSize;

        varying vec3 vWorldPos;
        varying vec3 vRayDir;

        // Hash / noise for cloud drift
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.0 + vec2(100.0);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vRayDir);
          float elevation = dir.y;

          // 1. Rayleigh & Mie atmospheric gradient
          vec3 skyGrad = mix(uHorizonColor, uZenithColor, clamp(pow(max(0.0, elevation), 0.5), 0.0, 1.0));
          if (elevation < 0.0) {
            skyGrad = mix(uHorizonColor, uGroundColor, clamp(-elevation * 3.0, 0.0, 1.0));
          }

          // 2. Solar Aureole & Sun Disc
          float cosTheta = dot(dir, uSunDir);
          float sunAureole = pow(max(0.0, cosTheta), 32.0) * 0.7;
          float sunDisc = smoothstep(1.0 - uSunDiscSize * 0.001, 1.0, cosTheta) * 3.5;

          vec3 color = skyGrad + (uSunColor * sunAureole) + (vec3(1.0, 0.95, 0.85) * sunDisc);

          // 3. Procedural Cloud Decks (Only above horizon)
          if (elevation > 0.05) {
            vec2 cloudUv = (dir.xz / (dir.y + 0.15)) * 0.8 + vec2(uTime * 0.008, uTime * 0.004);
            float cloudDensity = fbm(cloudUv * 3.0);
            float cloudMask = smoothstep(0.48, 0.75, cloudDensity) * smoothstep(0.05, 0.3, elevation);

            // Sunlit cloud coloring (Golden rim highlights)
            vec3 cloudBase = mix(uHorizonColor * 0.6, vec3(0.9, 0.92, 0.96), clamp(elevation * 2.0, 0.0, 1.0));
            vec3 cloudHighlight = uSunColor * (1.0 + pow(max(0.0, cosTheta), 8.0) * 1.5);
            vec3 cloudColor = mix(cloudBase, cloudHighlight, cloudDensity * 0.5);

            color = mix(color, cloudColor, cloudMask * 0.75);
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.domeMesh = new THREE.Mesh(domeGeo, skyMat);
    this.scene.add(this.domeMesh);
  }

  initCelestialLighting() {
    // Key Sun Directional Light with soft shadows
    this.sunLight = new THREE.DirectionalLight(0xffedd5, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.camera.left = -35;
    this.sunLight.shadow.camera.right = 35;
    this.sunLight.shadow.camera.top = 35;
    this.sunLight.shadow.camera.bottom = -35;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    // Hemispheric Ambient Light (Sky zenith vs ground reflection)
    this.hemiLight = new THREE.HemisphereLight(0x8cb0d0, 0x384450, 1.6);
    this.scene.add(this.hemiLight);

    // Global ambient fill to eliminate pitch black shadow crushing
    this.ambientLight = new THREE.AmbientLight(0x607080, 1.2);
    this.scene.add(this.ambientLight);
  }

  setTimeOfDay(hours) {
    this.timeOfDay = Math.max(0, Math.min(24, hours));
    this.updateSunPosition();
  }

  updateSunPosition() {
    // Spherical solar angle from hour
    const sunAngle = ((this.timeOfDay - 6) / 12) * Math.PI; // 6am = sunrise, 12 = noon, 18 = sunset
    const elevation = Math.sin(sunAngle);
    const azimuth = Math.cos(sunAngle);

    this.sunPosition.set(azimuth * 35, Math.max(0.05, elevation) * 40, -18);
    const sunDir = this.sunPosition.clone().normalize();

    this.skyUniforms.uSunDir.value.copy(sunDir);
    this.sunLight.position.copy(this.sunPosition);

    // Dynamic color tuning based on sun elevation (Golden hour -> Noon -> Twilight)
    if (elevation < 0.25) {
      // Golden Hour / Sunset
      this.skyUniforms.uHorizonColor.value.setHex(0xe67e22);
      this.skyUniforms.uZenithColor.value.setHex(0x1a3860);
      this.skyUniforms.uSunColor.value.setHex(0xffaa44);
      this.sunLight.color.setHex(0xffaa44);
      this.sunLight.intensity = 2.0;
      this.hemiLight.color.setHex(0x3a5070);
      this.hemiLight.groundColor.setHex(0x1a120c);
    } else if (elevation < 0.7) {
      // Afternoon Warm
      this.skyUniforms.uHorizonColor.value.setHex(0xd0a078);
      this.skyUniforms.uZenithColor.value.setHex(0x225599);
      this.skyUniforms.uSunColor.value.setHex(0xffe8cc);
      this.sunLight.color.setHex(0xffedd5);
      this.sunLight.intensity = 2.4;
      this.hemiLight.color.setHex(0x507595);
      this.hemiLight.groundColor.setHex(0x201c18);
    } else {
      // High Noon Crisp
      this.skyUniforms.uHorizonColor.value.setHex(0x9bc2e6);
      this.skyUniforms.uZenithColor.value.setHex(0x1e62b0);
      this.skyUniforms.uSunColor.value.setHex(0xffffff);
      this.sunLight.color.setHex(0xffffff);
      this.sunLight.intensity = 2.8;
      this.hemiLight.color.setHex(0x7090b0);
      this.hemiLight.groundColor.setHex(0x282c30);
    }
  }

  update(dt, camera) {
    this.skyUniforms.uTime.value += dt;
    if (camera) {
      this.domeMesh.position.copy(camera.position);
    }
  }
}
