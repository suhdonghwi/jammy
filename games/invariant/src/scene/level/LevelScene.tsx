import { useEffect } from 'react';
import { clickTile, tileClickable } from '../../director/frogs';
import { useGame } from '../../game/store';
import { AreaLayer } from '../area/AreaLayer';
import { cameraRig } from '../cameraRig';
import { Floor } from '../floor/Floor';
import { Frogs } from '../frogs/Frogs';
import { FrogTrail } from '../frogs/FrogTrail';
import { HatchShells } from '../frogs/Hatch';
import { HopArcs } from '../frogs/HopArcs';
import { Callouts, FailMarker } from '../labels/Callouts';
import { FrogTags } from '../labels/FrogTags';
import { OutlineRegion } from '../labels/Region';
import { HoverPreview } from './HoverPreview';

export function LevelScene() {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  useEffect(() => {
    if (useGame.getState().mode === 'tutorial') void cameraRig.resetAngle(false);
    else cameraRig.opening(level, false);
  }, [level]);

  return (
    <>
      <Floor
        key={level.id}
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
        area={reveal.area ? valid : null}
        dim={formula !== null && !formula.ok}
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showEggs={reveal.eggs}
      />
      <FrogTrail />
      <Frogs />
      <HatchShells />
      <HopArcs />
      <FrogTags />
      {reveal.hover && <HoverPreview />}
      <FailMarker />
      <OutlineRegion />
      <Callouts />
    </>
  );
}
