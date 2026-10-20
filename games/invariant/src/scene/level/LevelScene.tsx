import { useEffect } from 'react';
import { clickTile, tileClickable } from '../../director/frogs';
import { useGame } from '../../game/store';
import { planeKey, startView } from '../../levels/level';
import { AreaLayer } from '../area/AreaLayer';
import { cameraRig } from '../cameraRig';
import { Floor } from '../floor/Floor';
import { Frogs } from '../frogs/Frogs';
import { HatchShells } from '../frogs/Hatch';
import { Hand } from '../hand/Hand';
import { Callouts } from '../labels/Callouts';
import { FailMarker } from '../labels/FailMarker';
import { FrogTags } from '../labels/FrogTags';
import { HoverPreview } from './HoverPreview';

export function LevelScene() {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const key = planeKey(inputs);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  useEffect(() => {
    const v = startView(level);
    void cameraRig.resetAngle(false);
    void cameraRig.lookAtTile(v.x, v.y, v.distance, false);
  }, [level]);

  return (
    <>
      <Floor
        key={`${level.id}-${key}`}
        level={level}
        inputs={inputs}
        interactive
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showAxes={reveal.axes}
        onTile={clickTile}
        clickable={tileClickable}
      />
      <AreaLayer
        level={level}
        inputs={inputs}
        inv={valid?.fast ?? null}
        dim={formula !== null && !formula.ok}
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showEggs={reveal.eggs}
        showArea={reveal.formula}
      />
      <Frogs />
      <HatchShells />
      <FrogTags />
      {reveal.hover && <HoverPreview />}
      <FailMarker />
      <Callouts />
      <Hand />
    </>
  );
}
