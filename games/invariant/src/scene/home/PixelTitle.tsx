import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { Slabs } from '../AreaLayer';
import { useArea, useHomeLevel, useWanderers } from './common';

// Draft B: the title is spelled out in area slabs on the grid. Frogs wander
// over the letters and never step off them, which is the whole game in one
// picture.

const GLYPHS: Record<string, string[]> = {
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  V: ['#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  F: ['####', '#...', '###.', '#...', '#...'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
};

/** Tiles spelling `text`, centred on x = 0, with its top row at `top`. */
function spell(text: string, top: number): [number, number][] {
  const widths = [...text].map((c) => GLYPHS[c][0].length);
  const total = widths.reduce((a, b) => a + b, 0) + widths.length - 1;
  let x0 = -Math.floor(total / 2);
  const out: [number, number][] = [];
  [...text].forEach((c, i) => {
    GLYPHS[c].forEach((row, r) => {
      [...row].forEach((cell, k) => {
        if (cell === '#') out.push([x0 + k, top - r]);
      });
    });
    x0 += widths[i] + 1;
  });
  return out;
}

const TILES = [...spell('INVARIANT', 7), ...spell('FROG', 0)];

export function PixelTitleHome() {
  const level = useHomeLevel();
  const version = useArea(TILES);
  useWanderers(level, { tiles: TILES, count: 10, every: 0.95, straight: 0.75 });

  useEffect(() => {
    void cameraRig.controls?.setLookAt(0, 28, 15, 0, 0, -2, false);
  }, []);

  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    // far enough that the whole title (about 42 tiles wide) fits across, and
    // aimed below it so the title sits in the upper part, clear of the card
    const aspect = size.width / size.height;
    const d = Math.max(28, 23 / (0.325 * aspect * 1.31)) * 1.05;
    const sway = Math.sin(t * 0.1);
    void c.setLookAt(sway * 2.2, d * 1.15, 3 + d * 0.62, sway * 0.6, 0, 2.2, false);
  });

  return (
    <group>
      <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} />
      <Slabs version={version} dim={false} showStop={false} showGoal={false} />
      <Frogs />
    </group>
  );
}
