import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store/game";
import { COLORS, SLAB_H } from "./constants";
import { field } from "./field";
import { frogWorld } from "./frogSim";
import { SceneTag, type TagTone } from "./SceneTag";

// Where a check failed: a pulsing red outline and wash on the tile, and a small
// tag above it saying what went wrong. Frogs keep their own colours.

function roundedRect(w: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const h = w / 2;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

export interface TileTagProps {
  x: number;
  y: number;
  label: string;
  tone: TagTone;
  /** Pulse the outline (failures). */
  pulse?: boolean;
  /** Fill the tile with a faint wash. */
  wash?: boolean;
}

const TONE_COLORS: Record<TagTone, string> = {
  info: "#2b3445",
  good: "#2f9e44",
  fail: COLORS.fail,
};
const PREFIX: Record<TagTone, string> = { info: "", good: "✓ ", fail: "✕ " };

/** An outline on a tile and a small labelled tag floating above it. */
export function TileTag({
  x,
  y,
  label,
  tone,
  pulse = false,
  wash = false,
}: TileTagProps) {
  const color = TONE_COLORS[tone];
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const washRef = useRef<THREE.Mesh>(null);
  const t0 = useRef(performance.now());
  const geoms = useMemo(() => {
    const outer = roundedRect(1.0, 0.17);
    outer.holes.push(roundedRect(0.88, 0.12) as unknown as THREE.Path);
    return {
      ring: new THREE.ShapeGeometry(outer, 8).rotateX(-Math.PI / 2),
      wash: new THREE.ShapeGeometry(roundedRect(0.88, 0.12), 8).rotateX(
        -Math.PI / 2,
      ),
    };
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = (performance.now() - t0.current) / 1000;
    const base = field.heightAt(x, y) * SLAB_H;
    g.position.set(x, base + 0.012, -y);
    const pop = Math.min(1, t / 0.3);
    const beat = pulse ? 0.5 + 0.5 * Math.sin(t * 4.2) : 1;
    if (ring.current) {
      ring.current.scale.setScalar(
        0.9 + 0.1 * pop + (pulse ? 0.035 * beat : 0),
      );
      (ring.current.material as THREE.MeshBasicMaterial).opacity =
        pop * (pulse ? 0.75 + 0.25 * beat : 0.85);
    }
    if (washRef.current)
      (washRef.current.material as THREE.MeshBasicMaterial).opacity =
        pop * (0.12 + 0.1 * beat);
  });

  return (
    <>
      <group ref={group}>
        {wash && (
          <mesh ref={washRef} geometry={geoms.wash} renderOrder={8}>
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        )}
        <mesh ref={ring} geometry={geoms.ring} renderOrder={9}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      </group>
      <SceneTag anchor={{ tile: [x, y] }} tone={tone}>
        {PREFIX[tone]}
        {label}
      </SceneTag>
    </>
  );
}

/** Where the last check failed. Frogs keep their own colours. */
export function FailMarker() {
  const mark = useGame((s) => s.failMark);
  if (!mark) return null;
  return (
    <TileTag
      key={`${mark.x},${mark.y},${mark.t0}`}
      x={mark.x}
      y={mark.y}
      label={mark.label}
      tone="fail"
      pulse
      wash
    />
  );
}

/**
 * Tutorial hints ("egg: input n = 2", "Init", …): over a tile, with an outline,
 * or riding along with a frog.
 */
export function Callouts() {
  const callouts = useGame((s) => s.callouts);
  return (
    <>
      {callouts.map((c) => {
        if (c.frog !== undefined) {
          const frog = frogWorld.frogs.find((f) => f.id === c.frog);
          return frog ? (
            <SceneTag
              key={`f${c.frog},${c.text}`}
              anchor={{ frog }}
              tone={c.tone}
            >
              {PREFIX[c.tone]}
              {c.text}
            </SceneTag>
          ) : null;
        }
        return (
          <TileTag
            key={`${c.x},${c.y},${c.text}`}
            x={c.x}
            y={c.y}
            label={c.text}
            tone={c.tone}
          />
        );
      })}
    </>
  );
}
