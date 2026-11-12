import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import type { CompiledLevel, Formula, Inputs } from '../../levels/level';
import { tilesNear, type TileWindow } from '../../levels/tiles';
import { cameraRig } from '../cameraRig';
import { Eggs } from './Eggs';
import { field } from './field';
import { GoalColumns } from './GoalColumns';
import { areaMask } from './mask';
import { Slabs } from './Slabs';

interface AreaLayerProps {
  level: CompiledLevel;
  inputs: Inputs;
  area: Formula | null;
  dim: boolean;
  showStop: boolean;
  showGoal: boolean;
  showEggs: boolean;
}

const HEARD_WITHIN = 12;

export function useTileWindow(): TileWindow {
  const [win, setWin] = useState<TileWindow>({ cx: 0, cy: 0, R: 18 });
  const ref = useRef(win);
  useFrame(() => {
    const t = cameraRig.target();
    const d = cameraRig.distance();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(40, Math.max(16, Math.ceil((d * 1.7) / 4) * 4));
    const c = ref.current;
    if (Math.abs(cx - c.cx) > 3 || Math.abs(cy - c.cy) > 3 || R !== c.R) {
      ref.current = { cx, cy, R };
      setWin(ref.current);
    }
  });
  return win;
}

export function useArea(level: CompiledLevel, inputs: Inputs, area: Formula | null) {
  const gl = useThree((s) => s.gl);
  const latest = useRef(inputs);
  latest.current = inputs;
  useEffect(() => {
    field.inputs = latest.current;
    field.show(level, area);
    areaMask.show(level, area?.expr ?? null, field.before?.expr ?? null);
    const t = cameraRig.target();
    const near = { cx: Math.round(t.x), cy: Math.round(-t.z), R: HEARD_WITHIN };
    const moved = tilesNear(level, latest.current, near, (s) => (level.fast.planeReq(s) === true ? (area?.fast(s) === true ? 1 : 0) - (field.before?.fast(s) === true ? 1 : 0) : 0));
    sfx.slabs(moved.filter((m) => m > 0).length, moved.filter((m) => m < 0).length);
  }, [level, area]);
  useEffect(
    () => () => {
      field.reset();
      areaMask.clear();
    },
    [],
  );
  useFrame(() => {
    field.inputs = inputs;
    const t = cameraRig.target();
    areaMask.draw(gl, t.x, -t.z, inputs, field.risen());
  }, -1);
}

export function AreaLayer({ level, inputs, area, dim, showStop, showGoal, showEggs }: AreaLayerProps) {
  const win = useTileWindow();
  useArea(level, inputs, area);
  return (
    <group>
      <Slabs level={level} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs level={level} inputs={inputs} win={win} />}
      {showGoal && <GoalColumns level={level} inputs={inputs} win={win} />}
    </group>
  );
}
