/**
 * Shaders.js
 * Custom GLSL shaders for Time-Rewind Temporal Warp, Holographic Time Echoes, and HUD optics.
 */
import * as THREE from 'three';

export const TimeWarpShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uWarpIntensity: { value: 0.0 }, // 0.0 to 1.0
    uChromaticAberration: { value: 0.0 },
    uRewindActive: { value: 0.0 }, // 0.0 or 1.0
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uWarpIntensity;
    uniform float uChromaticAberration;
    uniform float uRewindActive;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 uv = vUv;
      vec2 offset = uv - center;
      float dist = length(offset);

      // Radial warp distortion
      if (uWarpIntensity > 0.01) {
        float factor = 1.0 + uWarpIntensity * sin(dist * 18.0 - uTime * 12.0) * 0.05 * dist;
        uv = center + offset * factor;
      }

      // Chromatic aberration
      float aberration = uChromaticAberration * (dist * 0.04 + 0.005);
      if (uRewindActive > 0.5) {
        aberration += 0.015 * sin(uTime * 30.0);
      }

      float r = texture2D(tDiffuse, uv + vec2(aberration, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(aberration, 0.0)).b;
      vec3 color = vec3(r, g, b);

      // Rewind scanlines & blue-cyan temporal tint
      if (uRewindActive > 0.5) {
        float scanline = sin(vUv.y * 400.0 - uTime * 50.0) * 0.15;
        color.r *= 0.6 + scanline;
        color.g *= 0.9 + scanline;
        color.b *= 1.2 + scanline;
        // Vignette
        color *= (1.0 - dist * 0.5);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createTimeEchoMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Color(0x00f0ff) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        // Fresnel edge glow
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
        // Scanlines
        float scan = sin(vPosition.y * 25.0 - uTime * 8.0) * 0.5 + 0.5;
        float alpha = fresnel * 0.85 + scan * 0.15;
        gl_FragColor = vec4(uColor, clamp(alpha, 0.1, 0.9));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
