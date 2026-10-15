import { useGame } from '../../game/store';
import { useLingering } from '../../ui/presence';
import { TileTag } from './TileTag';

/** Where the last check failed: a pulsing red outline and wash, and what went wrong. Frogs keep their own colours. */
export function FailMarker() {
  const { value: mark, leaving } = useLingering(useGame((s) => s.failMark));
  if (!mark) return null;
  return <TileTag key={`${mark.x},${mark.y},${mark.t0}`} x={mark.x} y={mark.y} label={mark.label} tone="fail" pulse wash leaving={leaving} />;
}
