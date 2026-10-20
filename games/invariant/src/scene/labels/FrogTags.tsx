import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import { useGame } from '../../game/store';
import { usePresentList } from '../../hooks/presence';
import type { State } from '../../lang/ast';
import { scalarNames, type CompiledLevel } from '../../levels/level';
import { frogWorld, type FrogSim } from '../frogs/frogWorld';
import { SceneTag } from './SceneTag';

// A little tag over each real frog listing its variables. When a hop changes a
// variable, the tag updates as the frog lands: the old value slips up and away
// while the new one rises into place with a brief warm tint.

const MAX_TAGS = 3;

export function FrogTags() {
  const on = useGame((s) => s.frogTags);
  const level = useGame((s) => s.level);
  const [frogs, setFrogs] = useState<FrogSim[]>([]);
  useFrame(() => {
    const list = on ? frogWorld.frogs.filter((f) => f.kind === 'real').slice(0, MAX_TAGS) : [];
    if (list.length !== frogs.length || list.some((f, i) => f !== frogs[i])) setFrogs(list);
  });
  // tags of frogs that went away (or when tags are turned off) fade out
  const shown = usePresentList(frogs, (f) => String(f.id));
  if (!level) return null;
  return (
    <>
      {shown.map(({ item: f, key, leaving }) => (
        <FrogTag key={key} frog={f} level={level} leaving={leaving} />
      ))}
    </>
  );
}

function FrogTag({ frog, level, leaving }: { frog: FrogSim; level: CompiledLevel; leaving: boolean }) {
  // the values shown change when the frog lands, not when it takes off
  const [shown, setShown] = useState<State>(frog.state);
  useFrame(() => {
    if (!frog.hop && frog.state !== shown) setShown(frog.state);
  });
  // step aside for another tag in the same spot: a callout or failure label on
  // this frog or on the tile it sits on
  const covered = () => {
    const { callouts, failMark } = useGame.getState();
    const onTile = (x: number, y: number) => !frog.hop && x === frog.x && y === frog.y;
    return (
      callouts.some((c) => c.frog === frog.id || (c.frog === undefined && onTile(c.x, c.y))) ||
      (!!failMark && onTile(failMark.x, failMark.y))
    );
  };
  return (
    <SceneTag anchor={{ frog }} hidden={covered} leaving={leaving}>
      {scalarNames(level)
        .filter((n) => n in shown)
        .map((n, i) => (
          <span key={n}>
            {i > 0 && ', '}
            {n} = <Value value={String(shown[n])} />
          </span>
        ))}
    </SceneTag>
  );
}

function Value({ value }: { value: string }) {
  // track changes during render, so the new value never shows un-animated
  const [cur, setCur] = useState({ v: value, k: 0, old: null as string | null });
  if (cur.v !== value) setCur({ v: value, k: cur.k + 1, old: cur.v });
  return (
    // both share one cell, so the width holds
    <span className="inline-grid justify-items-center overflow-hidden align-bottom *:[grid-area:1/1]">
      {cur.old !== null && (
        <span key={`o${cur.k}`} className="animate-[tag-old_0.28s_ease-in_forwards]">
          {cur.old}
        </span>
      )}
      <span key={`n${cur.k}`} className={cur.old !== null ? 'animate-[tag-new_0.7s_ease-out]' : ''}>
        {cur.v}
      </span>
    </span>
  );
}
