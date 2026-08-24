/**
 * Engine.js
 * Three.js renderer lifecycle, Dual-Engine graphics preset manager,
 * post-processing compositor, and viewport resize handler.
 */
import * as THREE from 'three';
import { TimeWarpShader } from '../world/Shaders.js';

export class Engine {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Graphics Settings Defaults
    this.settings = {
      preset: 'high', // 'low' (2009 laptop), 'medium', 'high'
      resolutionScale: 1.0,
      shadows: true,
      postProcessing: true,
      fpsCap: 0, // 0 = uncapped
    };

    this.initScene();
    this.initRenderer();
    this.initPostProcessing();
    this.setupResizeListener();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1017);
    this.scene.fog = new THREE.FogExp2(0x0c1017, 0.02);

    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.05, 100);
    this.camera.position.set(0, 1.6, 15);
    this.scene.add(this.camera);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  initPostProcessing() {
    // Custom Full-Screen Quad Shader for TimeWarp Post-Processing
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.warpMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(TimeWarpShader.uniforms),
      vertexShader: TimeWarpShader.vertexShader,
      fragmentShader: TimeWarpShader.fragmentShader,
    });
    this.warpMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(quadGeo, this.warpMaterial);
    this.postScene.add(quad);
  }

  setPreset(preset) {
    this.settings.preset = preset;
    if (preset === 'low') {
      // 2009 Laptop Preset
      this.settings.shadows = false;
      this.settings.postProcessing = false;
      this.settings.resolutionScale = 0.75;
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(0.85);
    } else if (preset === 'medium') {
      this.settings.shadows = true;
      this.settings.postProcessing = true;
      this.settings.resolutionScale = 0.9;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      this.renderer.setPixelRatio(1.0);
    } else {
      // High / Modern PC Preset
      this.settings.shadows = true;
      this.settings.postProcessing = true;
      this.settings.resolutionScale = 1.0;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }
    this.onWindowResize();
  }

  setupResizeListener() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    const effectiveWidth = Math.floor(this.width * this.settings.resolutionScale);
    const effectiveHeight = Math.floor(this.height * this.settings.resolutionScale);

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(effectiveWidth, effectiveHeight, false);
    this.renderer.domElement.style.width = `${this.width}px`;
    this.renderer.domElement.style.height = `${this.height}px`;

    this.renderTarget.setSize(effectiveWidth, effectiveHeight);
  }

  render(time, timeManager) {
    if (this.settings.postProcessing && (timeManager.warpIntensity > 0.01 || timeManager.rewindActive)) {
      // Update shader uniforms
      this.warpMaterial.uniforms.uTime.value = time;
      this.warpMaterial.uniforms.uWarpIntensity.value = timeManager.warpIntensity;
      this.warpMaterial.uniforms.uChromaticAberration.value = timeManager.chromaticAberration;
      this.warpMaterial.uniforms.uRewindActive.value = timeManager.rewindActive ? 1.0 : 0.0;

      // Render main scene into renderTarget
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(this.scene, this.camera);

      // Render post-processing quad to screen
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
    } else {
      // Direct render path (optimized for 2009 hardware & idle states)
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
  }
}
