import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/store';
import { cameraRig, VIEW } from '../cameraRig';
import { POND_SPACING } from '../constants';
import { after } from '../sceneTime';

/**
 * Ponds are stacked like floors of a building at y = n × spacing. Changing n
 * moves only the camera — up or down the stack — while the old floor fades out
 * and the new one fades in. Nothing else moves.
 */
export function useElevator() {
  const level = useGame((s) => s.level);
  const pond = useGame((s) => s.pond);
  const hasPonds = !!level?.pond;
  const layerY = hasPonds ? pond * POND_SPACING : 0;
  const [leaving, setLeaving] = useState<number[]>([]);
  const prev = useRef<{ level: typeof level; pond: number } | null>(null);

  useEffect(() => {
    cameraRig.layerY = layerY;
    const p = prev.current;
    prev.current = { level, pond };
    if (!level) return;
    const c = cameraRig.controls;
    if (!p || p.level !== level || !hasPonds) {
      // fresh level: place the camera without animation
      const cam = level.camera ?? { x: 0, y: 0 };
      void c?.rotateTo(VIEW.azimuth, VIEW.polar, false);
      void cameraRig.lookAtTile(cam.x, cam.y, (cam.distance ?? 15) * 1.2, false);
      setLeaving([]);
      return;
    }
    if (p.pond === pond) return;
    setLeaving((l) => [...l.filter((q) => q !== pond), p.pond]);
    const t = cameraRig.target();
    useGame.setState({ elevating: true, elevatorDir: Math.sign(pond - p.pond) });
    // Ride straight up or down: the old floor fades away at once, the new
    // floor fades in as the camera arrives.
    void (async () => {
      await c?.moveTo(t.x, layerY, t.z, true);
      useGame.setState({ elevating: false });
    })();
    return after(1200, () => setLeaving((l) => l.filter((q) => q !== p.pond)));
  }, [level, pond, layerY, hasPonds]);

  return { layerY, leaving };
}
