import { useEffect } from 'react';
import { clickTile, tileClickable } from '../../director/frogs';
import { useGame } from '../../game/store';
import { AreaLayer } from '../area/AreaLayer';
import { POND_SPACING } from '../constants';
import { Floor } from '../floor/Floor';
import { Frogs } from '../frogs/Frogs';
import { HatchShells } from '../frogs/Hatch';
import { Hand } from '../hand/Hand';
import { useHover } from '../hover';
import { AxisLabels } from '../labels/AxisLabels';
import { Callouts } from '../labels/Callouts';
import { FailMarker } from '../labels/FailMarker';
import { FrogTags } from '../labels/FrogTags';
import { BridgeCinematic } from './BridgeCinematic';
import { HoverPreview } from './HoverPreview';
import { useElevator } from './useElevator';

/** A level (or the tutorial): its pond's floor, the area, eggs and frogs, labels and the hand. */
export function LevelScene() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  const cinematic = useGame((s) => s.cinematic);
  const { layerY, leaving } = useElevator();
  useEffect(() => useHover.setState({ tile: null }), [level, pond]);

  if (cinematic) return <BridgeCinematic />;
  return (
    <>
      <Floor
        key={`floor-${pond}`}
        level={level}
        pond={pond}
        y={layerY}
        opacity={1}
        initialOpacity={leaving.length ? 0 : 1}
        fadeSpeed={leaving.length ? 3.5 : 5}
        fadeDelay={leaving.length ? 0.35 : 0}
        interactive
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showAxes={reveal.axes}
        onTile={clickTile}
        clickable={tileClickable}
      />
      {leaving.map((p) => (
        <Floor
          key={`floor-${p}`}
          level={level}
          pond={p}
          y={p * POND_SPACING}
          opacity={0}
          initialOpacity={1}
          fadeSpeed={6}
          showStop={reveal.stop}
          showGoal={reveal.goals}
          showAxes={reveal.axes}
        />
      ))}
      <group position={[0, layerY, 0]}>
        <AreaLayer
          level={level}
          pond={pond}
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
        <AxisLabels />
        <Hand />
      </group>
    </>
  );
}
