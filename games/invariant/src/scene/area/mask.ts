import * as THREE from 'three';
import type { Expr } from '../../lang/ast';
import { planeExists, planeKey, type Inputs } from '../../levels/inputs';
import type { CompiledLevel } from '../../levels/level';
import { inputUniforms, levelGlsl, setInputUniforms } from '../floor/levelGlsl';
import { planeShift } from '../planeShift';

export const MASK_SIZE = 352;
const SNAP = 16;
export const MASK_REACH = MASK_SIZE / 2 - SNAP / 2;

export const GOAL = 1;
export const EGG = 2;
export type MaskBit = typeof GOAL | typeof EGG;

const vertex = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const empty = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.0);
}
`;

function evaluator(level: CompiledLevel, area: Expr | null, before: Expr | null) {
  return /* glsl */ `
precision highp float;
precision highp int;
uniform vec2 uOrigin;
${levelGlsl(level, { area, before })}
void main() {
  ivec2 t = ivec2(int(uOrigin.x), int(uOrigin.y)) + ivec2(gl_FragCoord.xy);
  bool exists = uExists && L_exists(t);
  bool stop = exists && L_stop(t);
  gl_FragColor = vec4(
    exists && L_area(t) ? 1.0 : 0.0,
    exists && L_before(t) ? 1.0 : 0.0,
    stop ? 1.0 : 0.0,
    ((stop && L_goal(t) ? 1.0 : 0.0) + (exists && L_egg(t) ? 2.0 : 0.0)) / 3.0
  );
}
`;
}

const shader = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });

interface Snapshot {
  target: THREE.WebGLRenderTarget | null;
  pixels: Uint8Array;
  origin: { x: number; y: number };
}

const snapshot = (): Snapshot => ({ target: null, pixels: new Uint8Array(MASK_SIZE * MASK_SIZE * 4), origin: { x: 0, y: 0 } });

class AreaMask {
  readonly uniforms = {
    uMask: { value: null as THREE.Texture | null },
    uMaskOrigin: { value: new THREE.Vector2() },
    uMaskPrev: { value: null as THREE.Texture | null },
    uMaskPrevOrigin: { value: new THREE.Vector2() },
    uRise: { value: 1 },
    ...planeShift.uniforms,
  };
  private now = snapshot();
  private prev = snapshot();
  private shifting = false;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader(empty, {}));
  private level: CompiledLevel | null = null;
  private drawn = '';
  private shown = 0;
  private levels = 0;
  private read = '';
  revision = 0;

  constructor() {
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private use(material: THREE.ShaderMaterial, level: CompiledLevel | null) {
    this.quad.material.dispose();
    this.quad.material = material;
    if (level !== this.level) this.levels++;
    this.level = level;
    this.shown++;
  }

  show(level: CompiledLevel, area: Expr | null, before: Expr | null) {
    this.use(shader(evaluator(level, area, before), { ...inputUniforms(level), uOrigin: { value: new THREE.Vector2() } }), level);
  }

  clear() {
    this.use(shader(empty, {}), null);
    this.shifting = false;
  }

  tilesWithin(bit: MaskBit, cx: number, cy: number, R: number): [number, number][] {
    const out: [number, number][] = [];
    const seen = new Set<string>();
    for (const shot of this.shifting ? [this.now, this.prev] : [this.now]) {
      const { x: ox, y: oy } = shot.origin;
      for (let y = Math.max(oy, cy - R); y <= Math.min(oy + MASK_SIZE - 1, cy + R); y++) {
        for (let x = Math.max(ox, cx - R); x <= Math.min(ox + MASK_SIZE - 1, cx + R); x++) {
          const bits = Math.round(shot.pixels[((y - oy) * MASK_SIZE + (x - ox)) * 4 + 3] / 85);
          if (!(bits & bit) || Math.hypot(x - cx, y - cy) > R) continue;
          const key = `${x},${y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push([x, y]);
        }
      }
    }
    return out;
  }

  shiftPlane() {
    [this.now, this.prev] = [this.prev, this.now];
    this.now.origin = { ...this.prev.origin };
    this.drawn = '';
    this.read = '';
    this.shifting = true;
    this.revision++;
  }

  private settle(shifting: boolean) {
    if (this.shifting && !shifting) {
      this.shifting = false;
      this.revision++;
    }
  }

  draw(gl: THREE.WebGLRenderer, x: number, y: number, inputs: Inputs, risen: number, shifting: boolean) {
    this.settle(shifting);
    const target = (this.now.target ??= new THREE.WebGLRenderTarget(MASK_SIZE, MASK_SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }));
    this.uniforms.uMask.value = target.texture;
    this.uniforms.uMaskPrev.value = this.prev.target?.texture ?? target.texture;
    this.uniforms.uMaskPrevOrigin.value.set(this.prev.origin.x, this.prev.origin.y);
    this.uniforms.uRise.value = risen;
    const ox = Math.round(x / SNAP) * SNAP - MASK_SIZE / 2;
    const oy = Math.round(y / SNAP) * SNAP - MASK_SIZE / 2;
    const key = `${this.shown}|${ox},${oy}|${this.level ? planeKey(inputs) : ''}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.uniforms.uMaskOrigin.value.set(ox, oy);
    const u = (this.quad.material as THREE.ShaderMaterial).uniforms;
    if (this.level) {
      setInputUniforms(u, this.level, inputs, planeExists(this.level, inputs));
      (u.uOrigin.value as THREE.Vector2).set(ox, oy);
    }
    const back = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
    const read = `${this.levels}|${ox},${oy}|${this.level ? planeKey(inputs) : ''}`;
    if (read !== this.read) {
      this.read = read;
      gl.readRenderTargetPixels(target, 0, 0, MASK_SIZE, MASK_SIZE, this.now.pixels);
      this.now.origin = { x: ox, y: oy };
      this.revision++;
    }
    gl.setRenderTarget(back);
  }
}

export const areaMask = new AreaMask();
