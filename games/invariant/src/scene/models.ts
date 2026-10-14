import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from './constants';

// Procedural models in a soft, toy-like style. Each frog part carries an
// `aPart` id so a single draw call can tint the body per frog while keeping
// eyes, pupils, mouth and cheeks their own colors.

export const PART = { body: 0, belly: 1, sclera: 2, pupil: 3, shine: 4, mouth: 5, cheek: 6 } as const;

function tag(g: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.deleteAttribute('uv');
  return geo;
}

const sphere = (r: number, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);

export function frogGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, p: number) => parts.push(tag(g, p));

  // one soft, squat body
  add(sphere(0.27, 40, 28).scale(1.12, 0.78, 1.0).translate(0, 0.2, 0), PART.body);
  for (const s of [-1, 1]) {
    // eyes sit on top, in little body-colored bumps
    add(sphere(0.1, 28, 20).translate(s * 0.13, 0.35, 0.05), PART.body);
    add(sphere(0.082, 28, 20).translate(s * 0.135, 0.375, 0.09), PART.sclera);
    add(sphere(0.046, 20, 14).scale(1, 1.1, 0.6).translate(s * 0.138, 0.38, 0.158), PART.pupil);
    add(sphere(0.016, 10, 8).translate(s * 0.122, 0.405, 0.183), PART.shine);
    add(sphere(0.034, 16, 10).scale(1.4, 0.75, 0.35).translate(s * 0.17, 0.245, 0.205), PART.cheek);
    // two little front feet
    add(sphere(0.06, 18, 12).scale(1.25, 0.42, 1.15).translate(s * 0.13, 0.025, 0.2), PART.body);
  }
  // smile
  const arc = Math.PI * 0.6;
  const mouth = new THREE.TorusGeometry(0.07, 0.0095, 8, 28, arc);
  mouth.rotateZ(-Math.PI / 2 - arc / 2);
  mouth.rotateX(-0.3);
  mouth.translate(0, 0.275, 0.243);
  add(mouth, PART.mouth);

  const merged = mergeGeometries(parts)!;
  merged.computeBoundingSphere();
  return merged;
}

/** MeshStandardMaterial that colors frog parts by `aPart`, tinting the body by instance color. */
export function frogMaterial(opts: { ghost?: boolean; tint?: string } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    transparent: !!opts.ghost,
    opacity: opts.ghost ? 0.4 : 1,
    depthWrite: !opts.ghost,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: new THREE.Color(opts.tint ?? COLORS.frog) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nuniform vec3 uTint;')
      .replace(
        '#include <color_vertex>',
        /* glsl */ `
        vec3 tint = uTint;
        #ifdef USE_INSTANCING_COLOR
          tint = instanceColor.xyz;
        #endif
        vec3 c;
        if (aPart < 0.5) c = tint;
        else if (aPart < 1.5) c = mix(tint, vec3(1.0, 1.0, 0.86), 0.55);
        else if (aPart < 2.5) c = vec3(1.0);
        else if (aPart < 3.5) c = vec3(0.07, 0.08, 0.11);
        else if (aPart < 4.5) c = vec3(1.4);
        else if (aPart < 5.5) c = tint * 0.28;
        else c = vec3(1.0, 0.5, 0.56);
        vColor = vec4(c, 1.0);
        `,
      );
  };
  return m;
}

/**
 * Inverted-hull outline: back faces pushed out along normals by a constant
 * thickness. Works for plain and instanced meshes.
 */
export function outlineMaterial(thickness: number, color = COLORS.outline): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uThick: { value: thickness }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uThick;
      void main() {
        vec3 p = position + normalize(normal) * uThick;
        #ifdef USE_INSTANCING
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
        #else
          vec4 w = modelMatrix * vec4(p, 1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
