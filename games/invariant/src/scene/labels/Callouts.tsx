import { useRef } from 'react';
import { useGame, type Game } from '../../game/store';
import { usePresentList } from '../../ui/presence';
import { frogWorld, type FrogSim } from '../frogs/frogWorld';
import { SceneTag } from './SceneTag';
import { TileTag, TONE_PREFIX } from './TileTag';

type Callout = Game['callouts'][number];
const calloutKey = (c: Callout) => (c.frog !== undefined ? `f${c.frog},${c.text}` : `${c.x},${c.y},${c.text}`);

/**
 * Tutorial labels ("egg: input n = 2", "Init", …): over a tile, with an
 * outline, or riding along with a frog. Removed ones fade out.
 */
export function Callouts() {
  const callouts = usePresentList(
    useGame((s) => s.callouts),
    calloutKey,
  );
  // the frog a label rides on, remembered so it can still fade out with it
  const frogs = useRef(new Map<number, FrogSim>());
  return (
    <>
      {callouts.map(({ item: c, key, leaving }) => {
        // an outline alone (no text) also washes the tile, so it reads on a blue slab
        if (c.frog === undefined) return <TileTag key={key} x={c.x} y={c.y} label={c.text} tone={c.tone} wash={c.text === ''} leaving={leaving} />;
        const frog = frogWorld.frogs.find((f) => f.id === c.frog) ?? frogs.current.get(c.frog);
        if (!frog) return null;
        frogs.current.set(c.frog, frog);
        return (
          <SceneTag key={key} anchor={{ frog }} tone={c.tone} leaving={leaving}>
            {TONE_PREFIX[c.tone]}
            {c.text}
          </SceneTag>
        );
      })}
    </>
  );
}
