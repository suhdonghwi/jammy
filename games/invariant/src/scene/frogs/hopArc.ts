import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { hopHeight } from './motion';

const LIFT = 0.22;
const DASH = 0.1;
const GAP = 0.07;
const curve = new THREE.QuadraticBezierCurve3();

export type ArcEnd = readonly [x: number, y: number, ground: number];

export function arcPoints([fx, fy, h0]: ArcEnd, [tx, ty, h1]: ArcEnd, segments: number, count = segments): number[] {
  const H = hopHeight(Math.hypot(tx - fx, ty - fy));
  curve.v0.set(fx, h0 + LIFT, -fy);
  curve.v1.set((fx + tx) / 2, (h0 + h1) / 2 + 2 * H + LIFT, -(fy + ty) / 2);
  curve.v2.set(tx, h1 + LIFT, -ty);
  return Array.from({ length: count + 1 }, (_, k) => curve.getPoint(k / segments)).flatMap((v) => [v.x, v.y, v.z]);
}

/**
 * Cuts a polyline into its dashes, each one straight segment, as segment
 * pairs. A dash is short enough that its chord is its arc. LineMaterial's own
 * dashes are cut from a polyline whose joints have no caps, so they show
 * hairline gaps at every bend.
 */
export function dashes(points: number[]): number[] {
  const n = points.length / 3;
  const along = [0];
  for (let k = 1; k < n; k++)
    along.push(along[k - 1] + Math.hypot(points[k * 3] - points[k * 3 - 3], points[k * 3 + 1] - points[k * 3 - 2], points[k * 3 + 2] - points[k * 3 - 1]));
  const total = along[n - 1];
  let k = 0;
  const at = (d: number) => {
    while (k < n - 2 && along[k + 1] < d) k++;
    const t = along[k + 1] > along[k] ? (d - along[k]) / (along[k + 1] - along[k]) : 0;
    return [0, 1, 2].map((c) => points[k * 3 + c] + (points[k * 3 + 3 + c] - points[k * 3 + c]) * t);
  };
  const out: number[] = [];
  for (let s = 0; s < total; s += DASH + GAP) out.push(...at(s), ...at(Math.min(s + DASH, total)));
  return out;
}

/** Puts a polyline's dashes on an arc line. */
export function setArc(line: LineSegments2, points: number[]) {
  line.geometry.dispose();
  line.geometry = new LineSegmentsGeometry().setPositions(dashes(points));
  line.computeLineDistances();
}

export function useArcLine(color: string): LineSegments2 {
  const line = useMemo(() => {
    const material = new LineMaterial({
      color: new THREE.Color(color),
      linewidth: 2.5,
      // dashed only for its square ends: each segment is one whole dash
      dashed: true,
      dashSize: 1e6,
      gapSize: 0,
      transparent: true,
      depthWrite: false,
    });
    const l = new LineSegments2(new LineSegmentsGeometry(), material);
    l.frustumCulled = false;
    l.renderOrder = 10;
    l.userData.key = '';
    return l;
  }, [color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  return line;
}
