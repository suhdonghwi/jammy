import { Html, QuadraticBezierLine } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { COLORS } from './constants';
import { makeFrogGeometry } from './Frogs';
import { baseHeightAt, tileState } from './tiles';
import { director } from '../director/director';

export function HoverPreview() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const busy = useGame((s) => s.busy);
  const [tile, setTile] = useState<[number, number] | null>(null);
  const ghostGeom = useMemo(() => makeFrogGeometry(), []);
  const ghostRef = useRef<THREE.Mesh>(null);

  const info = useMemo(() => {
    if (!tile) return null;
    const s = tileState(level, tile[0], tile[1], pond);
    if (!level.fast.pondReq(s)) return null;
    const runningHere = level.fast.guard(s) === true;
    let to: [number, number] | null = null;
    if (runningHere) {
      const n: Record<string, number> = { ...s };
      for (const v in level.fast.next) n[v] = level.fast.next[v](s) as number;
      to = [n[level.view.x], n[level.view.y]];
    }
    return { s, runningHere, to };
  }, [tile, level, pond]);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const x = Math.round(e.point.x);
    const y = Math.round(-e.point.z);
    if (!tile || tile[0] !== x || tile[1] !== y) setTile([x, y]);
  };

  useFrame(({ clock }) => {
    const g = ghostRef.current;
    if (!g || !info?.to) return;
    const h = baseHeightAt(info.to[0], info.to[1]);
    g.position.set(info.to[0], h + 0.02 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.06, -info.to[1]);
  });

  const label = (vals: Record<string, number>) =>
    level.names.map((n) => `${n} = ${vals[n]}`).join(', ');

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.001, 0]}
        onPointerMove={onMove}
        onPointerOut={() => setTile(null)}
        onClick={(e) => {
          if (e.delta > 4) return;
          const x = Math.round(e.point.x);
          const y = Math.round(-e.point.z);
          director.clickTile(x, y);
        }}
      >
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {tile && info && (
        <group>
          <mesh position={[tile[0], baseHeightAt(tile[0], tile[1]) + 0.01, -tile[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.66, 4, 1, Math.PI / 4]} />
            <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.7} />
          </mesh>
          {reveal.hover && !busy && info.to && (
            <>
              <QuadraticBezierLine
                start={[tile[0], baseHeightAt(tile[0], tile[1]) + 0.25, -tile[1]]}
                end={[info.to[0], baseHeightAt(info.to[0], info.to[1]) + 0.25, -info.to[1]]}
                mid={[
                  (tile[0] + info.to[0]) / 2,
                  1.2 + 0.2 * Math.hypot(info.to[0] - tile[0], info.to[1] - tile[1]),
                  -(tile[1] + info.to[1]) / 2,
                ]}
                color={COLORS.ghost}
                lineWidth={2}
                dashed
                dashSize={0.12}
                gapSize={0.08}
              />
              <mesh ref={ghostRef} geometry={ghostGeom}>
                <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.35} depthWrite={false} />
              </mesh>
            </>
          )}
          <Html
            position={[tile[0], baseHeightAt(tile[0], tile[1]) + 0.7, -tile[1]]}
            center
            style={{ pointerEvents: 'none' }}
            zIndexRange={[10, 0]}
          >
            <div className="tile-tip">
              {label(info.s)}
              {reveal.stop && !info.runningHere && <span className="tip-stop"> · stops here</span>}
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}
