import { useMemo } from 'react';
import { useGame } from '../../game/store';
import { useHover } from '../hover';
import { textTexture } from '../shaders/common';

// The axes' names, written where the numbers are: "i →" in the corner of the
// tile just before the row's 0, and "n ↑" just before the column's 0, in the
// numbers' font and place (the near-left corner, see GLSL_DIGITS), so the row
// reads "i → 0 1 2 3" and the column "n ↑ 0 1 2 3". The hovered tile gets a
// small compass of its own: "i →" along its near edge and "n →" turned to run
// along its left edge, pointing away, so the directions can be read anywhere
// on the plane. Like the numbers, none of this hides a tile.

/** The tiles that carry the names (the floor leaves their numbers out). */
const X_TILE: [number, number] = [-1, 0];
const Y_TILE: [number, number] = [0, -1];
/** Height of the text in tiles: a little taller than the digits (0.23), and darker, so the names stand out. */
const SIZE = 0.3;
const COLOR = '#6b7689';
/** The hovered tile's compass: smaller, in ink, hugging the tile's edges. */
const COMPASS_SIZE = 0.19;
const COMPASS_COLOR = '#3f4a60';
const COMPASS_INSET = 0.33;
/** The digits' corner: their box starts at (-0.41, -0.42) in tile coordinates. */
const CORNER = { x: -0.41, y: -0.42 };

/** Textures by text (hovering around must not redraw them). */
const cache = new Map<string, ReturnType<typeof textTexture>>();
function cached(text: string, color: string) {
  const key = `${color} ${text}`;
  let t = cache.get(key);
  if (!t) {
    t = textTexture(text, color);
    cache.set(key, t);
  }
  return t;
}

/** Flat text on the floor, centred at (x, y), `turn` radians anticlockwise. */
function FloorText({ at, text, size, color, turn = 0 }: { at: [number, number]; text: string; size: number; color: string; turn?: number }) {
  const label = useMemo(() => cached(text, color), [text, color]);
  return (
    <mesh position={[at[0], 0.012, -at[1]]} rotation={[-Math.PI / 2, 0, turn]} renderOrder={7}>
      <planeGeometry args={[size * label.aspect, size]} />
      <meshBasicMaterial map={label.tex} transparent depthWrite={false} />
    </mesh>
  );
}

/** Text in a tile's near-left corner, where its number would be. */
function CornerText({ tile, text, size, color }: { tile: [number, number]; text: string; size: number; color: string }) {
  const label = cached(text, color);
  const w = size * label.aspect;
  return <FloorText at={[tile[0] + CORNER.x + w / 2, tile[1] + CORNER.y + size / 2]} text={text} size={size} color={color} />;
}

/** The plane's axes, named after the level's view variables (while the axes are revealed), and the hovered tile's compass. */
export function AxisLabels() {
  const level = useGame((s) => s.level);
  const on = useGame((s) => s.reveal.axes);
  const tile = useHover((s) => s.tile);
  if (!level || !on) return null;
  const { x, y } = level.view;
  return (
    <>
      <CornerText tile={X_TILE} text={`${x} →`} size={SIZE} color={COLOR} />
      <CornerText tile={Y_TILE} text={`${y} ↑`} size={SIZE} color={COLOR} />
      {tile && (
        <>
          <FloorText at={[tile[0], tile[1] - COMPASS_INSET]} text={`${x} →`} size={COMPASS_SIZE} color={COMPASS_COLOR} />
          {/* turned a quarter anticlockwise: reads from near to far, and its arrow points away */}
          <FloorText at={[tile[0] - COMPASS_INSET, tile[1]]} text={`${y} →`} size={COMPASS_SIZE} color={COMPASS_COLOR} turn={Math.PI / 2} />
        </>
      )}
    </>
  );
}
