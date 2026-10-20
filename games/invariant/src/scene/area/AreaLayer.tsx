import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../audio/sfx';
import type { FastFn } from '../../lang/eval';
import { planeKey, type CompiledLevel, type Inputs } from '../../levels/level';
import { tilesNear, type TileWindow } from '../../levels/tiles';
import { cameraRig } from '../cameraRig';
import { after } from '../sceneTime';
import { Eggs } from './Eggs';
import { field, RISE_DUR, type TileFlags } from './field';
import { GoalColumns } from './GoalColumns';
import { Slabs } from './Slabs';

interface AreaLayerProps {
  level: CompiledLevel;
  inputs: Inputs;
  inv: FastFn | null;
  dim: boolean;
  showStop: boolean;
  showGoal: boolean;
  showEggs: boolean;
  showArea: boolean;
}

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

export function AreaLayer({ level, inputs, inv, dim, showStop, showGoal, showEggs, showArea }: AreaLayerProps) {
  const win = useTileWindow();
  const [version, setVersion] = useState(0);
  const last = useRef<{ level: string; inv: FastFn | null; showArea: boolean } | null>(null);
  const key = planeKey(inputs);

  useEffect(() => {
    const prev = last.current;
    const fresh = !prev || prev.level !== level.id;
    if (fresh) field.reset();
    const animate = fresh || prev.inv !== inv || prev.showArea !== showArea;
    last.current = { level: level.id, inv, showArea };
    const f = level.fast;
    const tiles: TileFlags[] = !inv || !showArea ? [] : tilesNear(level, inputs, win, (s, x, y) => {
      if (!f.planeReq(s) || inv(s) !== true) return;
      const stop = f.guard(s) !== true;
      return { x, y, stop, goal: stop && f.post(s) === true };
    });
    const moved = field.update(tiles, animate);
    sfx.slabs(moved.rose, moved.sank);
    setVersion((v) => v + 1);
    return after(RISE_DUR * 1000 + 60, () => field.prune() && setVersion((v) => v + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, key, inv, win, showArea]);

  return (
    <group>
      <Slabs version={version} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs level={level} inputs={inputs} win={win} version={version} />}
      {showGoal && <GoalColumns level={level} inputs={inputs} win={win} version={version} />}
    </group>
  );
}
