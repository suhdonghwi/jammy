import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { clamp01 } from '../easing';
import { ringGeometry } from '../labels/TileTag';
import { sceneNow } from '../sceneTime';
import { frogWorld, type FrogSim } from './frogWorld';

const LIFT = 0.03;
const MAX_STEPS = 400;
const STEP_RADIUS = 0.11;

const stepGeometry = new THREE.CircleGeometry(STEP_RADIUS, 20).rotateX(-Math.PI / 2);
const m = new THREE.Matrix4();

const heightAt = (x: number, y: number) => field.heightAt(x, y) * SLAB_H + LIFT;

function trailFrog(plane: string): FrogSim | undefined {
  return frogWorld.frogs.filter((f) => f.kind === 'real' && f.trail && f.plane === plane).at(-1);
}

function pathOf(f: FrogSim): number[] {
  const points = f.trail!.flatMap(([x, y]) => [x, heightAt(x, y), -y]);
  if (f.hop) {
    const k = clamp01((sceneNow() - f.hop.t0) / f.hop.dur);
    const { fx, fy, tx, ty } = f.hop;
    const from = heightAt(fx, fy);
    points.push(fx + (tx - fx) * k, from + (heightAt(tx, ty) - from) * k, -(fy + (ty - fy) * k));
  }
  return points;
}

export function FrogTrail() {
  const size = useThree((s) => s.size);
  const plane = useGame((s) => planeKey(s.inputs));
  const steps = useRef<THREE.InstancedMesh>(null);
  const start = useRef<THREE.Mesh>(null);
  const parts = useMemo(() => {
    const material = new LineMaterial({ color: new THREE.Color(COLORS.trail), linewidth: 3, transparent: true, depthWrite: false });
    const line = new Line2(new LineGeometry(), material);
    line.frustumCulled = false;
    line.renderOrder = 9;
    line.visible = false;
    const flat = new THREE.MeshBasicMaterial({ color: COLORS.trail, transparent: true, depthWrite: false });
    return { line, flat };
  }, []);
  useEffect(
    () => () => {
      parts.line.geometry.dispose();
      parts.line.material.dispose();
      parts.flat.dispose();
    },
    [parts],
  );

  useFrame(() => {
    const { line, flat } = parts;
    const f = trailFrog(plane);
    const points = f ? pathOf(f) : [];
    const shown = !!f && points.length >= 6;
    line.visible = shown;
    if (steps.current) steps.current.visible = shown;
    if (start.current) start.current.visible = shown;
    if (!f || !shown) return;
    const opacity = f.leave ? 1 - clamp01((sceneNow() - f.leave.t0) / f.leave.dur) : 1;
    const key = points.join();
    if (key !== line.userData.key) {
      line.userData.key = key;
      line.geometry.dispose();
      line.geometry = new LineGeometry().setPositions(points);
    }
    line.material.opacity = 0.9 * opacity;
    line.material.resolution.set(size.width, size.height);
    flat.opacity = opacity;
    const [sx, sy] = f.trail![0];
    start.current?.position.set(sx, heightAt(sx, sy), -sy);
    const mesh = steps.current;
    if (!mesh) return;
    const count = Math.min(f.trail!.length, MAX_STEPS);
    f.trail!.slice(-count).forEach(([x, y], k) => mesh.setMatrixAt(k, m.makeTranslation(x, heightAt(x, y), -y)));
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <primitive object={parts.line} />
      <instancedMesh ref={steps} args={[stepGeometry, parts.flat, MAX_STEPS]} count={0} frustumCulled={false} renderOrder={9} visible={false} />
      <mesh ref={start} geometry={ringGeometry} material={parts.flat} renderOrder={9} visible={false} />
    </>
  );
}
