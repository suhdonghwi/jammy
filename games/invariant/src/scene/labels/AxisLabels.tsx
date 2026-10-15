import { useMemo } from 'react';
import { useGame } from '../../game/store';
import { chipTexture } from '../shaders/common';

// The axes' names: "i →" and "n ↑" as chips lying flat on the floor, in the
// numbers' font, just outside the numbered row and column near the origin
// (the floor tints those as a band, see floorShader). They stay put, like a
// chart's axis titles.

/** Where the chips sit: along the row below the numbers, and the column left of them. */
const X_CHIP: [number, number] = [2.5, -1];
const Y_CHIP: [number, number] = [-1, 2.5];
/** Height of the chip in tiles. */
const SIZE = 0.62;
const TEXT = '#3f4a60';
const FILL = '#d4e0f5';

function AxisName({ at, text }: { at: [number, number]; text: string }) {
  const label = useMemo(() => chipTexture(text, TEXT, FILL), [text]);
  return (
    <mesh position={[at[0], 0.012, -at[1]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}>
      <planeGeometry args={[SIZE * label.aspect, SIZE]} />
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
      <AxisName at={X_CHIP} text={`${level.view.x} →`} />
      <AxisName at={Y_CHIP} text={`${level.view.y} ↑`} />
    </>
  );
}
