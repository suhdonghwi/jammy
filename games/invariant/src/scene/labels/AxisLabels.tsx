import { useMemo } from 'react';
import { useGame } from '../../game/store';
import { useHover } from '../hover';
import { textTexture } from '../shaders/common';
import { tileState } from '../tiles';

// The axes' names, written where the numbers are: "i →" in the corner of the
// tile just before the row's 0, and "n ↑" just before the column's 0, in the
// numbers' font and place (the near-left corner, see GLSL_DIGITS), so the row
// reads "i → 0 1 2 3" and the column "n ↑ 0 1 2 3". While a tile is hovered,
// the numbers in its row and column read "i = 3" and "n = 2" instead (the
// floor leaves those digits out). Like the numbers, none of this hides a tile.

/** The tiles that carry the names (the floor leaves their numbers out). */
const X_TILE: [number, number] = [-1, 0];
const Y_TILE: [number, number] = [0, -1];
/** Height of the text in tiles: a little taller than the digits (0.23), and darker, so the names stand out. */
const SIZE = 0.3;
const COLOR = '#6b7689';
/** The hovered tile's coordinates on the axes: digit-sized, in ink. */
const HOVER_SIZE = 0.26;
const HOVER_COLOR = '#3f4a60';
/** The digits' corner: their box starts at (-0.41, -0.42) in tile coordinates. */
const CORNER = { x: -0.41, y: -0.42 };

/** Textures by text, so hovering around doesn't redraw one per frame. */
const cache = new Map<string, ReturnType<typeof textTexture>>();
function cached(text: string, color: string) {
  const key = `${color} ${text}`;
  let t = cache.get(key);
  if (!t) {
    if (cache.size > 200) cache.clear();
    t = textTexture(text, color);
    cache.set(key, t);
  }
  return t;
}

function CornerText({ tile, text, size, color }: { tile: [number, number]; text: string; size: number; color: string }) {
  const label = useMemo(() => cached(text, color), [text, color]);
  const w = size * label.aspect;
  // anchored at the corner like the digits: the box grows right and away from it
  const x = tile[0] + CORNER.x + w / 2;
  const y = tile[1] + CORNER.y + size / 2;
  return (
    <mesh position={[x, 0.012, -y]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
      <planeGeometry args={[w, size]} />
      <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** The plane's axes, named after the level's view variables (while the axes are revealed). */
export function AxisLabels() {
  const level = useGame((s) => s.level);
  const on = useGame((s) => s.reveal.axes);
  const pond = useGame((s) => s.pond);
  const tile = useHover((s) => s.tile);
  if (!level || !on) return null;
  const { x, y } = level.view;
  // the hovered tile's coordinates, on the axes (not for tiles no state can be on)
  const hovered = tile && level.fast.pondReq(tileState(level, tile[0], tile[1], pond)) ? tile : null;
  return (
    <>
      {hovered?.[0] !== -1 && <CornerText tile={X_TILE} text={`${x} →`} size={SIZE} color={COLOR} />}
      {hovered?.[1] !== -1 && <CornerText tile={Y_TILE} text={`${y} ↑`} size={SIZE} color={COLOR} />}
      {hovered && (
        <>
          <CornerText tile={[hovered[0], 0]} text={`${x} = ${hovered[0]}`} size={HOVER_SIZE} color={HOVER_COLOR} />
          <CornerText tile={[0, hovered[1]]} text={`${y} = ${hovered[1]}`} size={HOVER_SIZE} color={HOVER_COLOR} />
        </>
      )}
    </>
  );
}
