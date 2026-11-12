import * as THREE from 'three';
import type { Expr } from '../../lang/ast';
import { planeExists, planeKey, type CompiledLevel, type Inputs } from '../../levels/level';
import { GLSL_INT_HELPERS, inputUniforms, levelGlsl, setInputUniforms } from '../floor/levelGlsl';

export const MASK_SIZE = 352;
const SNAP = 16;
export const MASK_REACH = MASK_SIZE / 2 - SNAP / 2;

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
${GLSL_INT_HELPERS}
${levelGlsl(level, { area, before })}
void main() {
  ivec2 t = ivec2(int(uOrigin.x), int(uOrigin.y)) + ivec2(gl_FragCoord.xy);
  bool exists = uExists && L_exists(t);
  bool stop = exists && L_stop(t);
  gl_FragColor = vec4(
    exists && L_area(t) ? 1.0 : 0.0,
    exists && L_before(t) ? 1.0 : 0.0,
    stop ? 1.0 : 0.0,
    stop && L_goal(t) ? 1.0 : 0.0
  );
}
`;
}

const shader = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });

class AreaMask {
  readonly uniforms = {
    uMask: { value: null as THREE.Texture | null },
    uMaskOrigin: { value: new THREE.Vector2() },
    uRise: { value: 1 },
  };
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader(empty, {}));
  private level: CompiledLevel | null = null;
  private drawn = '';
  private shown = 0;

  constructor() {
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private use(material: THREE.ShaderMaterial, level: CompiledLevel | null) {
    this.quad.material.dispose();
    this.quad.material = material;
    this.level = level;
    this.shown++;
  }

  show(level: CompiledLevel, area: Expr | null, before: Expr | null) {
    this.use(shader(evaluator(level, area, before), { ...inputUniforms(level), uOrigin: { value: new THREE.Vector2() } }), level);
  }

  clear() {
    this.use(shader(empty, {}), null);
  }

  draw(gl: THREE.WebGLRenderer, x: number, y: number, inputs: Inputs, risen: number) {
    this.target ??= new THREE.WebGLRenderTarget(MASK_SIZE, MASK_SIZE, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.uniforms.uMask.value = this.target.texture;
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
    gl.setRenderTarget(this.target);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(back);
  }
}

export const areaMask = new AreaMask();
