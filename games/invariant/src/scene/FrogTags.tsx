import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import type { State } from '../lang/ast';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { frogWorld, type FrogSim } from './frogSim';

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
  if (!level) return null;
  return (
    <>
      {frogs.map((f) => (
        <FrogTag key={f.id} frog={f} level={level} />
      ))}
    </>
  );
}

function FrogTag({ frog, level }: { frog: FrogSim; level: CompiledLevel }) {
  const group = useRef<THREE.Group>(null);
  const box = useRef<HTMLDivElement>(null);
  // the values shown change when the frog lands, not when it takes off
  const [shown, setShown] = useState<State>(frog.state);
  useFrame(() => {
    const g = group.current;
    const p = frog.drawn;
    if (g && p) g.position.set(p.x, p.ground + 0.98, p.z);
    if (!frog.hop && frog.state !== shown) setShown(frog.state);
    // step aside for a callout or failure tag on the same tile (they sit in the same spot)
    const { callouts, failMark } = useGame.getState();
    const onTile = (x: number, y: number) => !frog.hop && x === frog.x && y === frog.y;
    const covered = callouts.some((c) => onTile(c.x, c.y)) || (!!failMark && onTile(failMark.x, failMark.y));
    box.current?.classList.toggle('covered', covered);
  });
  return (
    <group ref={group}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={box} className="frog-tag">
          {[level.view.x, level.view.y, ...level.names.filter((n) => n !== level.view.x && n !== level.view.y)]
            .filter((n) => n in shown)
            .map((n, i) => (
              <span key={n} className="frog-tag-var">
                {i > 0 && ', '}
                {n} = <Value value={String(shown[n])} />
              </span>
            ))}
        </div>
      </Html>
    </group>
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
