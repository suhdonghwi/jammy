import { useFrame } from '@react-three/fiber';
import { useState } from 'react';
import type { State } from '../lang/ast';
import { displayNames, type CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { frogWorld, type FrogSim } from './frogSim';
import { SceneTag } from './SceneTag';
import { usePresentList } from '../ui/presence';

// A little tag over each real frog listing its variables. When a hop changes a
// variable, the tag updates as the frog lands: the old value is struck out and
// drifts away while the new one pops in, highlighted.

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
      {displayNames(level)
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
    <span className="frog-tag-val">
      {cur.old !== null && (
        <span key={`o${cur.k}`} className="old">
          {cur.old}
        </span>
      )}
      <span key={`n${cur.k}`} className={cur.old !== null ? 'new' : ''}>
        {cur.v}
      </span>
    </span>
  );
}
