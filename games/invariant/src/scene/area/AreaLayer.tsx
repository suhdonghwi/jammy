import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { sfx } from '../../audio/sfx';
import { planeKey, type Inputs } from '../../levels/inputs';
import type { CompiledLevel, Formula } from '../../levels/level';
import { cameraRig } from '../cameraRig';
import { goalEvents } from '../goalEvents';
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

function useArea(level: CompiledLevel, inputs: Inputs, area: Formula | null) {
  const gl = useThree((s) => s.gl);
  const latest = useRef(inputs);
  latest.current = inputs;
  useEffect(() => {
    field.inputs = latest.current;
    field.show(level, area);
    areaMask.show(level, area?.expr ?? null, field.before?.expr ?? null);
    const t = cameraRig.target();
    const { rising, sinking } = field.movedNear({ cx: Math.round(t.x), cy: Math.round(-t.z), R: HEARD_WITHIN });
    sfx.slabs(rising, sinking);
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
    goalEvents.sync(planeKey(inputs));
    const t = cameraRig.target();
    areaMask.draw(gl, t.x, -t.z, inputs, field.risen());
  }, -1);
}

export function AreaLayer({ level, inputs, area, dim, showStop, showGoal, showEggs }: AreaLayerProps) {
  useArea(level, inputs, area);
  return (
    <group>
      <Slabs level={level} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs />}
      {showGoal && <GoalColumns />}
    </group>
  );
}
