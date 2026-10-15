import { useEffect } from 'react';
import { clickTile, tileClickable } from '../../director/frogs';
import { useGame } from '../../game/store';
import { startView } from '../../levels/level';
import { AreaLayer } from '../area/AreaLayer';
import { cameraRig, VIEW } from '../cameraRig';
import { Floor } from '../floor/Floor';
import { Frogs } from '../frogs/Frogs';
import { HatchShells } from '../frogs/Hatch';
import { Hand } from '../hand/Hand';
import { useHover } from '../hover';
import { Callouts } from '../labels/Callouts';
import { FailMarker } from '../labels/FailMarker';
import { FrogTags } from '../labels/FrogTags';
import { HoverPreview } from './HoverPreview';

/**
 * A level (or the tutorial): its plane's floor, the area, eggs and frogs,
 * labels and the hand. Moving the slider to another plane swaps it at once; the camera
 * stays where it is.
 */
export function LevelScene() {
  const level = useGame((s) => s.level)!;
  const plane = useGame((s) => s.plane);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  useEffect(() => useHover.setState({ tile: null }), [level, plane]);
  // a fresh level: the camera is placed at its starting view, without animation
  useEffect(() => {
    const v = startView(level);
    void cameraRig.controls?.rotateTo(VIEW.azimuth, VIEW.polar, false);
    void cameraRig.lookAtTile(v.x, v.y, v.distance, false);
  }, [level]);

  return (
    <>
      <Floor
        key={`floor-${plane}`}
        level={level}
        plane={plane}
        opacity={1}
        interactive
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showAxes={reveal.axes}
        onTile={clickTile}
        clickable={tileClickable}
      />
      <AreaLayer
        level={level}
        plane={plane}
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
