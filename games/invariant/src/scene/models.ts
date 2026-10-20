import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from './constants';

// Procedural models in a soft, toy-like style. Each frog part carries an
// `aPart` id so a single draw call can tint the body per frog while keeping
// eyes, pupils, mouth and cheeks their own colors.

const PART = { body: 0, torso: 1, sclera: 2, pupil: 3, shine: 4, mouth: 5, cheek: 6 } as const;

/** The whole frog is scaled by this once its parts are put together. */
const FROG_SCALE = 1.15;
/**
 * The pale belly, painted on the torso where it lies inside this ellipsoid
 * (radii, centre, and the torso's lean). It used to be a second, flatter
 * sphere poking out of the torso, but the two met at so shallow an angle that
 * their facets took turns in front along the edge, in jagged pale slivers.
 */
const BELLY = { r: [0.1035, 0.1265, 0.0575], c: [0, 0.17, 0.06], lean: -0.42 };

// Parts stay indexed: a vertex shared by its neighbouring triangles is shaded
// once, not once per triangle, which matters with a few hundred frogs out.
function tag(g: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.deleteAttribute('uv');
  return g;
}

/**
 * The frog. A board frog is small on screen and there can be a few hundred of
 * them (frog rain), so its parts are only as round as they look at the
 * closest zoom; `fine` is for the one big frog in the title.
 */
export function frogGeometry({ fine = false }: { fine?: boolean } = {}): THREE.BufferGeometry {
  const k = fine ? 3 : 2;
  /** Smooth sphere (segment hints are scaled up for a soft surface). */
  const lp = (r: number, w = 9, h = 7) => new THREE.SphereGeometry(r, Math.max(fine ? 20 : 12, w * k), Math.max(fine ? 14 : 8, h * k));
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, p: number) => parts.push(tag(g, p));

  // A slim frog sitting up: leaning body, a wide head, eyes on top.
  add(lp(0.15, 9, 7).scale(1.0, 1.3, 1.0).rotateX(BELLY.lean).translate(0, 0.18, -0.03), PART.torso);
  add(lp(0.14, 10, 7).scale(1.2, 0.72, 1.0).translate(0, 0.32, 0.06), PART.body);
  for (const s of [-1, 1]) {
    add(lp(0.062, 8, 6).translate(s * 0.1, 0.39, 0.06), PART.body);
    add(lp(0.052, 10, 8).translate(s * 0.105, 0.405, 0.09), PART.sclera);
    add(lp(0.028, 8, 6).scale(1, 1.15, 0.7).translate(s * 0.11, 0.41, 0.133), PART.pupil);
    // folded back legs and long feet
    add(lp(0.1, 8, 6).scale(0.5, 0.75, 1.25).translate(s * 0.135, 0.09, -0.06), PART.body);
    add(lp(0.06, 8, 4).scale(0.95, 0.3, 1.55).translate(s * 0.15, 0.016, 0.05), PART.body);
    // thin front arms
    add(new THREE.CapsuleGeometry(0.028, 0.1, fine ? 6 : 3, fine ? 14 : 10).rotateX(0.2).translate(s * 0.078, 0.08, 0.1), PART.body);
    add(lp(0.034, 7, 4).scale(1.3, 0.4, 1.2).translate(s * 0.08, 0.012, 0.125), PART.body);
  }
  const merged = mergeGeometries(parts)!;
  merged.scale(FROG_SCALE, FROG_SCALE, FROG_SCALE);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * A see-through frog is see-through as a whole, not part by part: this pass
 * draws its depth first (renderOrder one below the frog's), so only its front
 * surface is blended, once, over what is behind it. Both passes are in the
 * transparent queue, after the (transparent) floor, so the floor under the
 * frog is already there to blend over.
 */
export function ghostDepthMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
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
    const [rx, ry, rz] = BELLY.r.map((r) => r.toFixed(4));
    const [cx, cy, cz] = BELLY.c.map((c) => c.toFixed(4));
    const lean = (-BELLY.lean).toFixed(4);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nuniform vec3 uTint;\nvarying vec3 vBelly;\nvarying float vTorso;')
      .replace(
        '#include <color_vertex>',
        /* glsl */ `
        vec3 tint = uTint;
        #ifdef USE_INSTANCING_COLOR
          tint = instanceColor.xyz;
        #endif
        // where this point is in the belly's ellipsoid (inside: length < 1), undoing its placement and lean
        vec3 b = position / ${FROG_SCALE.toFixed(4)} - vec3(${cx}, ${cy}, ${cz});
        float cl = cos(${lean}), sl = sin(${lean});
        vBelly = vec3(b.x, b.y * cl - b.z * sl, b.y * sl + b.z * cl) / vec3(${rx}, ${ry}, ${rz});
        vTorso = aPart > 0.5 && aPart < 1.5 ? 1.0 : 0.0;
        vec3 c;
        if (aPart < 1.5) c = tint;
        else if (aPart < 2.5) c = vec3(1.0);
        else if (aPart < 3.5) c = vec3(0.07, 0.08, 0.11);
        else if (aPart < 4.5) c = vec3(1.4);
        else if (aPart < 5.5) c = tint * 0.28;
        else c = vec3(1.0, 0.5, 0.56);
        vColor = vec4(c, 1.0);
        `,
      );
    // the belly, painted per pixel with a soft edge
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBelly;\nvarying float vTorso;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.86), 0.55 * vTorso * (1.0 - smoothstep(0.92, 1.0, length(vBelly))));',
      );
  };
  return m;
}

/**
 * Inverted-hull outline: back faces pushed out along normals by a constant
 * thickness. Works for plain and instanced meshes. `back` sets it that much
 * further from the camera, so where the hull pokes through the shape's own
 * front (in its concave corners) it stays hidden behind it.
 */
export function outlineMaterial(thickness: number, color = COLORS.outline, back = 0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uThick: { value: thickness }, uBack: { value: back }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uThick;
      uniform float uBack;
      void main() {
        vec3 p = position + normalize(normal) * uThick;
        #ifdef USE_INSTANCING
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
        #else
          vec4 w = modelMatrix * vec4(p, 1.0);
        #endif
        vec4 v = viewMatrix * w;
        v.xyz += normalize(v.xyz) * uBack;
        gl_Position = projectionMatrix * v;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * A copy of `geom` for outlineMaterial to draw: its vertices welded and their
 * normals smoothed. On a hard-edged shape (an extruded letter) each corner has
 * a normal per face, so the hull pushed out along them would tear open at the
 * seams and show as a ragged, speckled edge.
 */
export function outlineGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', geom.getAttribute('position'));
  if (geom.index) g.setIndex(geom.index);
  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

/** An egg, standing on its base at the origin. */
export function eggGeometry() {
  const pts: THREE.Vector2[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 bottom → 1 top
    const a = Math.PI * t;
    // egg profile: wider near the bottom
    const r = Math.sin(a) * (0.19 - 0.042 * t);
    const y = (1 - Math.cos(a)) * 0.182;
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return new THREE.LatheGeometry(pts, 28);
}
