import { useMemo } from 'react';
import { useGame } from '../../game/store';
import { textTexture } from '../shaders/common';

// The axes' names, written where the numbers are: "i →" in the corner of the
// tile just before the row's 0, and "n ↑" just before the column's 0, in the
// numbers' font and place (the near-left corner, see GLSL_DIGITS), so the row
// reads "i → 0 1 2 3" and the column "n ↑ 0 1 2 3". Like the numbers, they
// hide nothing.

/** The tiles that carry the names (the floor leaves their numbers out). */
const X_TILE: [number, number] = [-1, 0];
const Y_TILE: [number, number] = [0, -1];
/** Height of the text in tiles: a little taller than the digits (0.23), and darker, so the names stand out. */
const SIZE = 0.3;
const COLOR = '#6b7689';
/** The digits' corner: their box starts at (-0.41, -0.42) in tile coordinates. */
const CORNER = { x: -0.41, y: -0.42 };

function AxisName({ tile, text }: { tile: [number, number]; text: string }) {
  const label = useMemo(() => textTexture(text, COLOR), [text]);
  const w = SIZE * label.aspect;
  // anchored at the corner like the digits: the box grows right and away from it
  const x = tile[0] + CORNER.x + w / 2;
  const y = tile[1] + CORNER.y + SIZE / 2;
  return (
    <mesh position={[x, 0.012, -y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
      <planeGeometry args={[w, SIZE]} />
      <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** The plane's axes, named after the level's view variables (while the axes are revealed). */
export function AxisLabels() {
  const level = useGame((s) => s.level);
  const on = useGame((s) => s.reveal.axes);
  if (!level || !on) return null;
  return (
    <>
      <AxisName tile={X_TILE} text={`${level.view.x} →`} />
      <AxisName tile={Y_TILE} text={`${level.view.y} ↑`} />
    </>
  );
}
