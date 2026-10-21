import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { COLORS } from '../constants';
import { hopHeight } from './motion';

const SEGMENTS = 24;
const LIFT = 0.22;
const curve = new THREE.QuadraticBezierCurve3();

export interface HopPath {
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  drawn: number;
  opacity: number;
}

export function HopLine({ path }: { path: () => HopPath | null }) {
  const size = useThree((s) => s.size);
  const line = useMemo(() => {
    const material = new LineMaterial({
      color: new THREE.Color(COLORS.hopLine),
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
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );

  useFrame(() => {
    const p = path();
    line.visible = !!p && p.opacity > 0 && p.drawn > 0;
    if (!p || !line.visible) return;
    const [fx, fy, h0] = p.from;
    const [tx, ty, h1] = p.to;
    const key = [fx, fy, h0, tx, ty, h1].map((v) => v.toFixed(3)).join();
    if (key !== line.userData.key) {
      line.userData.key = key;
      const H = hopHeight(Math.hypot(tx - fx, ty - fy));
      curve.v0.set(fx, h0 + LIFT, -fy);
      curve.v1.set((fx + tx) / 2, (h0 + h1) / 2 + 2 * H + LIFT, -(fy + ty) / 2);
      curve.v2.set(tx, h1 + LIFT, -ty);
      line.geometry.setPositions(curve.getPoints(SEGMENTS).flatMap((v) => [v.x, v.y, v.z]));
      line.computeLineDistances();
    }
    line.geometry.instanceCount = Math.max(1, Math.round(SEGMENTS * Math.min(1, p.drawn)));
    line.material.opacity = 0.9 * p.opacity;
    line.material.resolution.set(size.width, size.height);
  });

  return <primitive object={line} />;
}
