import * as THREE from 'three';
import { planeKey, type Inputs } from '../levels/inputs';
import { BASE, reducedMotion } from '../motion';
import { clamp01, smootherstep } from './easing';

export const PLANE_TILE = BASE;
const WAVE_PER_TILE = 0.035;
const WAVE_SPREAD = 0.3;

export interface Wave {
  perTile: number;
  spread: number;
  tile: number;
}

export const planeWave = (reduced: boolean): Wave => (reduced ? { perTile: 0, spread: 0, tile: BASE } : { perTile: WAVE_PER_TILE, spread: WAVE_SPREAD, tile: PLANE_TILE });

export const waveLength = (w: Wave) => w.spread + w.tile;

export function waveMix(w: Wave, age: number, distance: number): number {
  if (age >= waveLength(w)) return 1;
  const delay = Math.min(distance * w.perTile, w.spread);
  return smootherstep(clamp01((age - delay) / w.tile));
}

export const PLANE_SHIFT = waveLength(planeWave(false));

export const GLSL_PLANE_WAVE = /* glsl */ `
uniform float uPlaneAge;
uniform vec2 uPlaneCenter;
uniform vec3 uPlaneWave;
float planeMix(vec2 tile) {
  float delay = min(length(tile - uPlaneCenter) * uPlaneWave.x, uPlaneWave.y);
  float u = clamp((uPlaneAge - delay) / uPlaneWave.z, 0.0, 1.0);
  return u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
}
bool planeShifting() {
  return uPlaneAge < uPlaneWave.y + uPlaneWave.z;
}
`;

class PlaneShift {
  readonly uniforms = {
    uPlaneAge: { value: 1e6 },
    uPlaneCenter: { value: new THREE.Vector2() },
    uPlaneWave: { value: new THREE.Vector3() },
  };
  key: string | null = null;
  prevKey: string | null = null;
  before: Inputs | null = null;
  private owner: object | null = null;
  private last: Inputs | null = null;
  private t0 = -Infinity;
  private center = { x: 0, y: 0 };
  private aim: { x: number; y: number } | null = null;
  private wave = planeWave(false);

  aimAt(x: number, y: number) {
    this.aim = { x, y };
  }

  track(owner: object, inputs: Inputs, t: number, view: () => { x: number; y: number }): boolean {
    if (owner !== this.owner) {
      this.reset();
      this.owner = owner;
    }
    const key = planeKey(inputs);
    let changed = false;
    if (this.key === null) this.key = key;
    else if (key !== this.key) {
      this.before = this.last;
      this.prevKey = this.key;
      this.key = key;
      this.t0 = t;
      this.center = this.aim ?? view();
      this.wave = planeWave(reducedMotion());
      changed = true;
    }
    if (changed || !this.shifting(t)) this.aim = null;
    if (!this.shifting(t)) this.prevKey = null;
    this.last = inputs;
    this.uniforms.uPlaneAge.value = Math.min(1e6, t - this.t0);
    this.uniforms.uPlaneCenter.value.set(this.center.x, this.center.y);
    this.uniforms.uPlaneWave.value.set(this.wave.perTile, this.wave.spread, this.wave.tile);
    return changed;
  }

  planes(): string[] {
    return [this.key, this.prevKey].filter((k): k is string => k !== null);
  }

  shifting(t: number): boolean {
    return t - this.t0 < waveLength(this.wave);
  }

  mixAt(x: number, y: number, t: number): number {
    return waveMix(this.wave, t - this.t0, Math.hypot(x - this.center.x, y - this.center.y));
  }

  visibility(plane: string, x: number, y: number, t: number): number {
    if (this.key === null) return 1;
    if (plane === this.key) return this.prevKey === null ? 1 : this.mixAt(x, y, t);
    if (plane === this.prevKey) return 1 - this.mixAt(x, y, t);
    return 0;
  }

  reset() {
    this.owner = null;
    this.last = null;
    this.key = null;
    this.prevKey = null;
    this.before = null;
    this.t0 = -Infinity;
    this.aim = null;
    this.uniforms.uPlaneAge.value = 1e6;
  }
}

export const planeShift = new PlaneShift();
