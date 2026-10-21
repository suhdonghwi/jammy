import { useEffect } from 'react';
import { clickTile, tileClickable } from '../../director/frogs';
import { useGame } from '../../game/store';
import { planeKey, startView } from '../../levels/level';
import { AreaLayer } from '../area/AreaLayer';
import { cameraRig } from '../cameraRig';
import { Floor } from '../floor/Floor';
import { GroundBursts } from '../frogs/Burst';
import { Frogs } from '../frogs/Frogs';
import { HatchShells } from '../frogs/Hatch';
import { HopArcs } from '../frogs/HopArcs';
import { Callouts, FailMarker } from '../labels/Callouts';
import { FrogTags } from '../labels/FrogTags';
import { OutlineRegion } from '../labels/Region';
import { HoverPreview } from './HoverPreview';

export function LevelScene() {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const key = planeKey(inputs);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  useEffect(() => {
    void cameraRig.resetAngle(false);
    if (useGame.getState().mode === 'tutorial') return;
    const v = startView(level);
    void cameraRig.frame({ at: [v.x, v.y, v.distance], focus: [[v.x, v.y]] }, false);
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
        showArea={reveal.area}
      />
      <Frogs />
      <HatchShells />
      <GroundBursts />
      <HopArcs />
      <FrogTags />
      {reveal.hover && <HoverPreview />}
      <FailMarker />
      <OutlineRegion />
      <Callouts />
    </>
  );
}
