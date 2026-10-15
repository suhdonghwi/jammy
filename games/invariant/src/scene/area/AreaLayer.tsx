import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { FastFn } from '../../lang/eval';
import type { CompiledLevel } from '../../levels/level';
import { cameraRig } from '../cameraRig';
import { after } from '../sceneTime';
import { tileState, type TileWindow } from '../tiles';
import { Eggs } from './Eggs';
import { field, RISE_DUR, type TileFlags } from './field';
import { GoalColumns } from './GoalColumns';
import { Slabs } from './Slabs';

// Everything that stands on the floor of a level: the learner's area (slabs),
// the eggs and the goal columns, for the tiles around the camera.

interface AreaLayerProps {
  level: CompiledLevel;
  pond: number;
  inv: FastFn | null;
  dim: boolean;
  showStop: boolean;
  showGoal: boolean;
  showEggs: boolean;
  showArea: boolean;
}

/** The square of tiles around the camera's target that is built; it moves in steps as the camera does. */
function useTileWindow(): TileWindow {
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

export function AreaLayer({ level, pond, inv, dim, showStop, showGoal, showEggs, showArea }: AreaLayerProps) {
  const win = useTileWindow();
  const [version, setVersion] = useState(0);
  const last = useRef<{ key: string; inv: FastFn | null; showArea: boolean } | null>(null);

  // Recompute the area for the window. Slabs animate when the formula (or the
  // pond) changes — not when the window merely follows the camera.
  useEffect(() => {
    const key = `${level.id}|${pond}`;
    const prev = last.current;
    if (!prev || prev.key !== key) field.reset();
    const animate = !prev || prev.key !== key || prev.inv !== inv || prev.showArea !== showArea;
    last.current = { key, inv, showArea };
    const tiles: TileFlags[] = [];
    if (inv && showArea) {
      const f = level.fast;
      const { cx, cy, R } = win;
      for (let y = cy - R; y <= cy + R; y++) {
        for (let x = cx - R; x <= cx + R; x++) {
          const s = tileState(level, x, y, pond);
          if (!f.pondReq(s) || inv(s) !== true) continue;
          const stop = f.guard(s) !== true;
          tiles.push({ x, y, stop, goal: stop && f.post(s) === true });
        }
      }
    }
    field.update(tiles, animate);
    setVersion((v) => v + 1);
    return after(RISE_DUR * 1000 + 60, () => field.prune() && setVersion((v) => v + 1));
  }, [level, pond, inv, win, showArea]);

  return (
    <group>
      <Slabs version={version} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs level={level} pond={pond} win={win} version={version} />}
      {showGoal && <GoalColumns level={level} pond={pond} win={win} version={version} />}
    </group>
  );
}
