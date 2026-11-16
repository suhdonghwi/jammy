import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { hopHeight } from './motion';

const LIFT = 0.22;
const curve = new THREE.QuadraticBezierCurve3();

export type ArcEnd = readonly [x: number, y: number, ground: number];

export function arcPoints([fx, fy, h0]: ArcEnd, [tx, ty, h1]: ArcEnd, segments: number, count = segments): number[] {
  const H = hopHeight(Math.hypot(tx - fx, ty - fy));
  curve.v0.set(fx, h0 + LIFT, -fy);
  curve.v1.set((fx + tx) / 2, (h0 + h1) / 2 + 2 * H + LIFT, -(fy + ty) / 2);
  curve.v2.set(tx, h1 + LIFT, -ty);
  return Array.from({ length: count + 1 }, (_, k) => curve.getPoint(k / segments)).flatMap((v) => [v.x, v.y, v.z]);
}

export function useArcLine(color: string): Line2 {
  const line = useMemo(() => {
    const material = new LineMaterial({
      color: new THREE.Color(color),
      linewidth: 2.5,
      dashed: true,
      dashSize: 0.1,
      gapSize: 0.07,
      transparent: true,
      depthWrite: false,
    });
    const l = new Line2(new LineGeometry(), material);
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
