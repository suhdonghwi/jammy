import { useFrame, useThree } from '@react-three/fiber';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { field } from '../area/field';
import { COLORS } from '../constants';
import { clamp01 } from '../easing';
import { planeShift } from '../planeShift';
import { sceneNow } from '../sceneTime';
import { leaveFade, shownTrails, type FrogSim } from './frogWorld';
import { arcPoints, useArcLine, type ArcEnd } from './hopArc';

const TRAILS = 4;
const SEGMENTS = 16;

type Tile = readonly [number, number];

const onGround = ([x, y]: Tile): ArcEnd => [x, y, field.groundAt(x, y)];

function arc(from: Tile, to: Tile, upTo = 1): number[] {
  return arcPoints(onGround(from), onGround(to), SEGMENTS, Math.round(SEGMENTS * clamp01(upTo)));
}

function pathOf(f: FrogSim): number[] {
  const trail = f.trail!;
  const points = trail.slice(1).flatMap((to, k) => arc(trail[k], to));
  if (f.hop) points.push(...arc([f.hop.fx, f.hop.fy], [f.hop.tx, f.hop.ty], (sceneNow() - f.hop.t0) / f.hop.dur));
  return points;
}

function TrailLine({ index }: { index: number }) {
  const size = useThree((s) => s.size);
  const line = useArcLine(COLORS.trail);

  useFrame(() => {
    const f = shownTrails()[index];
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
    const t = sceneNow();
    line.material.opacity = 0.9 * leaveFade(f, t) * planeShift.visibility(f.plane, f.x, f.y, t);
    line.material.resolution.set(size.width, size.height);
  });

  return <primitive object={line} />;
}

export function FrogTrail() {
  return Array.from({ length: TRAILS }, (_, index) => <TrailLine key={index} index={index} />);
}
