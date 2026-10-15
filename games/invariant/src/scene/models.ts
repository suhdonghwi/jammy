import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from './constants';

// Procedural models in a soft, toy-like style. Each frog part carries an
// `aPart` id so a single draw call can tint the body per frog while keeping
// eyes, pupils, mouth and cheeks their own colors.

const PART = { body: 0, belly: 1, sclera: 2, pupil: 3, shine: 4, mouth: 5, cheek: 6 } as const;

function tag(g: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.deleteAttribute('uv');
  return geo;
}

/** Smooth sphere (segment hints are scaled up for a soft surface). */
const lp = (r: number, w = 9, h = 7) => new THREE.SphereGeometry(r, Math.max(20, w * 3), Math.max(14, h * 3));

export function frogGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, p: number) => parts.push(tag(g, p));

  // A slim frog sitting up: leaning body, a wide head, eyes on top.
  add(lp(0.15, 9, 7).scale(1.0, 1.3, 1.0).rotateX(-0.42).translate(0, 0.18, -0.03), PART.body);
  add(lp(0.115, 8, 6).scale(0.9, 1.1, 0.5).rotateX(-0.42).translate(0, 0.17, 0.06), PART.belly);
  add(lp(0.14, 10, 7).scale(1.2, 0.72, 1.0).translate(0, 0.32, 0.06), PART.body);
  for (const s of [-1, 1]) {
    add(lp(0.062, 8, 6).translate(s * 0.1, 0.39, 0.06), PART.body);
    add(lp(0.052, 10, 8).translate(s * 0.105, 0.405, 0.09), PART.sclera);
    add(lp(0.028, 8, 6).scale(1, 1.15, 0.7).translate(s * 0.11, 0.41, 0.133), PART.pupil);
    // folded back legs and long feet
    add(lp(0.1, 8, 6).scale(0.5, 0.75, 1.25).translate(s * 0.135, 0.09, -0.06), PART.body);
    add(lp(0.06, 8, 4).scale(0.95, 0.3, 1.55).translate(s * 0.15, 0.016, 0.05), PART.body);
    // thin front arms
    add(new THREE.CapsuleGeometry(0.028, 0.1, 6, 14).rotateX(0.2).translate(s * 0.078, 0.08, 0.1), PART.body);
    add(lp(0.034, 7, 4).scale(1.3, 0.4, 1.2).translate(s * 0.08, 0.012, 0.125), PART.body);
  }
  const merged = mergeGeometries(parts)!;
  merged.scale(1.15, 1.15, 1.15);
  merged.computeBoundingSphere();
  return merged;
}

/** MeshStandardMaterial that colors frog parts by `aPart`, tinting the body by instance color. */
export function frogMaterial(opts: { ghost?: boolean } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.45,
    metalness: 0,
    transparent: !!opts.ghost,
    opacity: opts.ghost ? 0.4 : 1,
    depthWrite: !opts.ghost,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = { value: new THREE.Color(COLORS.frog) };
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
