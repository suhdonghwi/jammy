import * as THREE from 'three';
import { SLAB_H } from '../constants';
import { uploadInstances } from '../instances';
import { MASK_REACH } from './mask';

const CELL_Y = SLAB_H / 2;
const SHADOW_HALF_DIAGONAL = 1.03;
const GRID_ROUNDING = Math.SQRT1_2;
const CELL_RADIUS = SHADOW_HALF_DIAGONAL + GRID_ROUNDING;
const SAME_POSE = 1e-4;

const grid = (() => {
  const cells: [number, number, number][] = [];
  for (let y = -MASK_REACH; y <= MASK_REACH; y++) {
    for (let x = -MASK_REACH; x <= MASK_REACH; x++) {
      const d = Math.hypot(x, y);
      if (d <= MASK_REACH) cells.push([x, y, d]);
    }
  }
  cells.sort((a, b) => a[2] - b[2]);
  const offsets = new Float32Array(cells.length * 2);
  const within = new Uint32Array(MASK_REACH + 1);
  cells.forEach(([x, y, d], i) => {
    offsets.set([x, y], i * 2);
    within.fill(i + 1, Math.ceil(d));
  });
  return { offsets, within };
})();

const frustum = new THREE.Frustum();
const clip = new THREE.Matrix4();
const eye = new THREE.Vector3();
const planes = new Float64Array(6 * 3);

const cellAttribute = () => new THREE.InstancedBufferAttribute(new Float32Array(grid.offsets.length), 2).setUsage(THREE.DynamicDrawUsage);

export class VisibleCells {
  readonly near = cellAttribute();
  readonly far = cellAttribute();
  nearCount = 0;
  farCount = 0;
  private pose: number[] = [];

  update(camera: THREE.Camera, target: THREE.Vector3, reach: number, farBeyond: number) {
    camera.updateMatrixWorld();
    eye.copy(camera.position).sub(target);
    const q = camera.quaternion;
    const p = camera.projectionMatrix.elements;
    const pose = [eye.x, eye.y, eye.z, q.x, q.y, q.z, q.w, p[0], p[5], reach, farBeyond];
    if (pose.every((v, i) => Math.abs(v - this.pose[i]) < SAME_POSE)) return;
    this.pose = pose;

    clip.copy(camera.matrixWorld).setPosition(eye).invert().premultiply(camera.projectionMatrix);
    frustum.setFromProjectionMatrix(clip);
    frustum.planes.forEach(({ normal, constant }, k) => {
      planes[k * 3] = normal.x;
      planes[k * 3 + 1] = -normal.z;
      planes[k * 3 + 2] = normal.y * CELL_Y + constant + CELL_RADIUS;
    });

    const near = this.near.array as Float32Array;
    const far = this.far.array as Float32Array;
    const farBeyond2 = farBeyond * farBeyond;
    const height2 = (eye.y - CELL_Y) * (eye.y - CELL_Y);
    let n = 0;
    let f = 0;
    const count = grid.within[reach];
    cells: for (let i = 0; i < count; i++) {
      const x = grid.offsets[i * 2];
      const y = grid.offsets[i * 2 + 1];
      for (let k = 0; k < 18; k += 3) if (planes[k] * x + planes[k + 1] * y + planes[k + 2] < 0) continue cells;
      const dx = x - eye.x;
      const dz = -y - eye.z;
      if (dx * dx + dz * dz + height2 > farBeyond2) {
        far[f++] = x;
        far[f++] = y;
      } else {
        near[n++] = x;
        near[n++] = y;
      }
    }
    this.nearCount = n / 2;
    this.farCount = f / 2;
    uploadInstances(this.nearCount, this.near);
    uploadInstances(this.farCount, this.far);
  }
}
