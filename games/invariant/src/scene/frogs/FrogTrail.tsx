import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { clamp01 } from '../easing';
import { sceneNow } from '../sceneTime';
import { trailFrogs, type FrogSim } from './frogWorld';
import { hopHeight } from './motion';

const TRAILS = 4;
const SEGMENTS = 16;
const LIFT = 0.22;
const curve = new THREE.QuadraticBezierCurve3();

type Tile = readonly [number, number];

function arc(from: Tile, to: Tile, upTo = 1): number[] {
  const h0 = field.heightAt(from[0], from[1]) * SLAB_H;
  const h1 = field.heightAt(to[0], to[1]) * SLAB_H;
  const H = hopHeight(Math.hypot(to[0] - from[0], to[1] - from[1]));
  curve.v0.set(from[0], h0 + LIFT, -from[1]);
  curve.v1.set((from[0] + to[0]) / 2, (h0 + h1) / 2 + 2 * H + LIFT, -(from[1] + to[1]) / 2);
  curve.v2.set(to[0], h1 + LIFT, -to[1]);
  const count = Math.round(SEGMENTS * clamp01(upTo));
  return Array.from({ length: count + 1 }, (_, k) => curve.getPoint(k / SEGMENTS)).flatMap((v) => [v.x, v.y, v.z]);
}

function pathOf(f: FrogSim): number[] {
  const trail = f.trail!;
  const points = trail.slice(1).flatMap((to, k) => arc(trail[k], to));
  if (f.hop) points.push(...arc([f.hop.fx, f.hop.fy], [f.hop.tx, f.hop.ty], (sceneNow() - f.hop.t0) / f.hop.dur));
  return points;
}

function TrailLine({ index }: { index: number }) {
  const size = useThree((s) => s.size);
  const plane = useGame((s) => planeKey(s.inputs));
  const line = useMemo(() => {
    const material = new LineMaterial({
      color: new THREE.Color(COLORS.trail),
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
    l.visible = false;
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
    const f = trailFrogs(plane)[index];
    const points = f ? pathOf(f) : [];
    line.visible = !!f && points.length >= 6;
    if (!f || !line.visible) return;
    const key = points.join();
    if (key !== line.userData.key) {
      line.userData.key = key;
      line.geometry.dispose();
      line.geometry = new LineGeometry().setPositions(points);
      line.computeLineDistances();
    }
    line.material.opacity = 0.9 * (f.leave ? 1 - clamp01((sceneNow() - f.leave.t0) / f.leave.dur) : 1);
    line.material.resolution.set(size.width, size.height);
  });

  return <primitive object={line} />;
}

export function FrogTrail() {
  return Array.from({ length: TRAILS }, (_, index) => <TrailLine key={index} index={index} />);
}
