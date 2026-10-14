import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { cameraRig } from './cameraRig';
import { COLORS, SLAB_H, TILE } from './constants';
import { frogWorld } from './frogSim';
import { computeWindow, sceneShared, windowIndex, type WindowData } from './tiles';

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

/** Window of tiles that follows the camera target, sized by zoom. */
function useTileWindow(): { cx: number; cy: number; R: number } {
  const [win, setWin] = useState({ cx: 0, cy: 0, R: 24 });
  const ref = useRef(win);
  useFrame(() => {
    const t = cameraRig.target();
    const d = cameraRig.distance();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(70, Math.max(18, Math.ceil((d * 1.9) / 6) * 6));
    const cur = ref.current;
    if (Math.abs(cx - cur.cx) > 4 || Math.abs(cy - cur.cy) > 4 || R !== cur.R) {
      ref.current = { cx, cy, R };
      setWin(ref.current);
    }
  });
  return win;
}

export function PondLayer() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  const reveal = useGame((s) => s.reveal);
  const { cx, cy, R } = useTileWindow();

  const data = useMemo(
    () => computeWindow(level, pond, valid?.fast ?? null, cx, cy, R),
    [level, pond, valid, cx, cy, R],
  );
  const dim = formula !== null && !formula.ok;
  const showSlabs = reveal.formula;

  // Carry animated heights across window changes so slabs don't pop.
  const heightsRef = useRef<Float32Array | null>(null);
  const prevWin = useRef<WindowData | null>(null);
  useMemo(() => {
    const old = prevWin.current;
    const oldH = heightsRef.current;
    const h = new Float32Array(data.size * data.size);
    if (old && oldH && old.pondKey === pond) {
      for (let j = 0; j < data.size; j++) {
        for (let i = 0; i < data.size; i++) {
          const k = windowIndex(old, data.cx - data.R + i, data.cy - data.R + j);
          if (k >= 0) h[j * data.size + i] = oldH[k];
        }
      }
    }
    heightsRef.current = h;
    prevWin.current = Object.assign(data, { pondKey: pond });
    sceneShared.win = data;
    sceneShared.heights = h;
  }, [data, pond]);

  return (
    <group>
      {/* backing: tile gaps read as grid lines, and lower ponds never show through */}
      <mesh position={[data.cx, -0.01, -data.cy]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[data.size + 40, data.size + 40]} />
        <meshBasicMaterial color={COLORS.background} />
      </mesh>
      <Floor data={data} showStop={reveal.stop} />
      {reveal.stop && <StopEdges data={data} />}
      <Slabs data={data} heights={heightsRef.current!} visible={showSlabs} dim={dim} showStop={reveal.stop} />
      {reveal.goals && <Goals data={data} />}
      {reveal.eggs && <Eggs data={data} />}
      {reveal.axes && <AxisNumbers data={data} xName={level.view.x} yName={level.view.y} />}
    </group>
  );
}

declare module './tiles' {
  interface WindowData {
    pondKey?: number;
  }
}

function Floor({ data, showStop }: { data: WindowData; showStop: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2), []);
  const max = data.size * data.size;
  useEffect(() => {
    const m = ref.current!;
    let n = 0;
    for (let j = 0; j < data.size; j++) {
      for (let i = 0; i < data.size; i++) {
        const k = j * data.size + i;
        if (!data.exists[k]) continue;
        dummy.position.set(data.cx - data.R + i, 0, -(data.cy - data.R + j));
        dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix);
        m.setColorAt(n, tmpColor.set(showStop && data.stop[k] ? COLORS.stopTile : COLORS.tile));
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [data, showStop]);
  return (
    <instancedMesh key={max} ref={ref} args={[geom, undefined, max]} receiveShadow frustumCulled={false}>
      <meshStandardMaterial roughness={0.95} metalness={0} />
    </instancedMesh>
  );
}

/** Thin line where the continue region meets the stop region; rides on top of slabs. */
function StopEdges({ data }: { data: WindowData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.BoxGeometry(1, 0.012, 0.05), []);
  const max = data.size * data.size * 2;
  const edges = useMemo(() => {
    const out: { k: number; q: number; x: number; y: number; vertical: boolean }[] = [];
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= data.size || j >= data.size ? -1 : j * data.size + i);
    for (let j = 0; j < data.size; j++) {
      for (let i = 0; i < data.size; i++) {
        const k = at(i, j);
        if (!data.exists[k] || !data.stop[k]) continue;
        const x = data.cx - data.R + i;
        const y = data.cy - data.R + j;
        const nbrs: [number, number, number, number, boolean][] = [
          [i + 1, j, x + 0.5, y, true],
          [i - 1, j, x - 0.5, y, true],
          [i, j + 1, x, y + 0.5, false],
          [i, j - 1, x, y - 0.5, false],
        ];
        for (const [ni, nj, ex, ey, vertical] of nbrs) {
          const q = at(ni, nj);
          if (q < 0 || !data.exists[q] || data.stop[q]) continue;
          out.push({ k, q, x: ex, y: ey, vertical });
        }
      }
    }
    return out;
  }, [data]);
  useFrame(() => {
    const m = ref.current;
    const h = sceneShared.heights;
    if (!m || !h || sceneShared.win !== data) return;
    edges.forEach((e, n) => {
      dummy.position.set(e.x, Math.max(h[e.k], h[e.q]) + 0.006, -e.y);
      dummy.rotation.set(0, e.vertical ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
    });
    dummy.rotation.set(0, 0, 0);
    m.count = edges.length;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh key={max} ref={ref} args={[geom, undefined, max]} frustumCulled={false}>
      <meshBasicMaterial color={COLORS.stopLine} />
    </instancedMesh>
  );
}

function makeSlabGeometry() {
  const g = new THREE.BoxGeometry(TILE, 1, TILE);
  g.translate(0, 0.5, 0);
  const n = g.attributes.normal;
  const colors = new Float32Array(n.count * 3);
  const top = new THREE.Color(1, 1, 1);
  const side = new THREE.Color(0.76, 0.78, 0.82);
  for (let i = 0; i < n.count; i++) {
    const c = n.getY(i) > 0.5 ? top : side;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function Slabs({
  data,
  heights,
  visible,
  dim,
  showStop,
}: {
  data: WindowData;
  heights: Float32Array;
  visible: boolean;
  dim: boolean;
  showStop: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const max = data.size * data.size;
  const geom = useMemo(() => {
    const g = makeSlabGeometry();
    g.setAttribute('aH', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
    return g;
  }, [max]);
  const { material, depth } = useMemo(() => {
    const inject = (shader: { vertexShader: string }) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aH;')
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = aH < 0.002 ? vec3(0.0) : vec3(position.x, position.y * aH, position.z);',
        );
    };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, transparent: true });
    material.onBeforeCompile = inject;
    // The shadow pass needs the same height logic, or every tile casts a full-height shadow.
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = inject;
    return { material, depth };
  }, []);
  useEffect(() => {
    const m = ref.current!;
    for (let k = 0; k < max; k++) {
      const i = k % data.size;
      const j = Math.floor(k / data.size);
      dummy.position.set(data.cx - data.R + i, 0, -(data.cy - data.R + j));
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
      // slabs in the stop region are a grayer blue, so the loop's stop region stays readable
      m.setColorAt(k, tmpColor.set(showStop && data.stop[k] ? COLORS.slabStop : COLORS.slab));
    }
    m.count = max;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data, max, showStop]);
  useFrame((_, dt) => {
    const attr = geom.getAttribute('aH') as THREE.InstancedBufferAttribute;
    const arr = attr.array as Float32Array;
    const rate = 1 - Math.exp(-dt * 9);
    let changed = false;
    for (let k = 0; k < max; k++) {
      const target = visible && data.area[k] && data.exists[k] ? SLAB_H : 0;
      const cur = heights[k];
      if (cur !== target) {
        const nv = Math.abs(target - cur) < 0.002 ? target : cur + (target - cur) * rate;
        heights[k] = nv;
        changed = true;
      }
      if (arr[k] !== heights[k]) {
        arr[k] = heights[k];
        changed = true;
      }
    }
    if (changed) attr.needsUpdate = true;
    material.opacity += ((dim ? 0.45 : 1) - material.opacity) * rate;
  });
  return (
    <instancedMesh
      key={max}
      ref={ref}
      args={[geom, material, max]}
      customDepthMaterial={depth}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
}

function useHeightFollower(
  data: WindowData,
  mask: Uint8Array,
  place: (m: THREE.InstancedMesh, n: number, x: number, y: number, h: number, k: number) => void,
) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lastVersion = useRef(-1);
  useFrame(() => {
    const m = ref.current;
    const h = sceneShared.heights;
    if (!m || !h || sceneShared.win !== data) return;
    let n = 0;
    for (let k = 0; k < mask.length; k++) {
      if (!mask[k] || !data.exists[k]) continue;
      const i = k % data.size;
      const j = Math.floor(k / data.size);
      place(m, n++, data.cx - data.R + i, data.cy - data.R + j, h[k], k);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    lastVersion.current = frogWorld.version;
  });
  return ref;
}

function Goals({ data }: { data: WindowData }) {
  const geom = useMemo(() => new THREE.RingGeometry(0.17, 0.27, 28).rotateX(-Math.PI / 2), []);
  const max = data.size * data.size;
  const ref = useHeightFollower(data, data.goal, (m, n, x, y, h) => {
    dummy.position.set(x, h + 0.006, -y);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    m.setMatrixAt(n, dummy.matrix);
  });
  return (
    <instancedMesh key={max} ref={ref} args={[geom, undefined, max]} frustumCulled={false}>
      <meshBasicMaterial color={COLORS.goal} />
    </instancedMesh>
  );
}

function Eggs({ data }: { data: WindowData }) {
  const geom = useMemo(() => new THREE.SphereGeometry(0.17, 18, 14), []);
  const max = data.size * data.size;
  const ref = useHeightFollower(data, data.egg, (m, n, x, y, h) => {
    const hatched = frogWorld.hatched.has(`${x},${y}`);
    const s = hatched ? 0.0001 : 1;
    dummy.position.set(x, h + 0.2 * s, -y);
    dummy.scale.set(s, 1.25 * s, s);
    dummy.updateMatrix();
    m.setMatrixAt(n, dummy.matrix);
  });
  return (
    <instancedMesh key={max} ref={ref} args={[geom, undefined, max]} castShadow frustumCulled={false}>
      <meshStandardMaterial color={COLORS.egg} roughness={0.7} />
    </instancedMesh>
  );
}

// ---- numbers printed on the axes ----

const textureCache = new Map<string, THREE.Texture>();
function labelTexture(text: string, bold = false): THREE.Texture {
  const key = `${bold}:${text}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bold ? '#5b6472' : '#9aa1ad';
  g.font = `${bold ? 600 : 500} ${bold ? 54 : 46}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  textureCache.set(key, t);
  return t;
}

function AxisNumbers({ data, xName, yName }: { data: WindowData; xName: string; yName: string }) {
  const labels = useMemo(() => {
    const out: { x: number; y: number; text: string; bold?: boolean }[] = [];
    const lim = Math.min(data.R, 30);
    for (let x = data.cx - lim; x <= data.cx + lim; x++) {
      const k = windowIndex(data, x, 0);
      if (k >= 0 && data.exists[k]) out.push({ x, y: 0, text: x === 0 ? '0' : String(x) });
    }
    for (let y = data.cy - lim; y <= data.cy + lim; y++) {
      if (y === 0) continue;
      const k = windowIndex(data, 0, y);
      if (k >= 0 && data.exists[k]) out.push({ x: 0, y, text: String(y) });
    }
    return out;
  }, [data]);
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = groupRef.current;
    const h = sceneShared.heights;
    if (!g || !h || sceneShared.win !== data) return;
    g.children.forEach((child, idx) => {
      const l = labels[idx];
      if (!l) return;
      const k = windowIndex(data, l.x, l.y);
      child.position.y = (k >= 0 ? h[k] : 0) + 0.008;
    });
  });
  return (
    <group>
      <group ref={groupRef}>
        {labels.map((l) => (
          <mesh key={`${l.x},${l.y}`} position={[l.x - 0.3, 0.008, -l.y + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.36, 0.36]} />
            <meshBasicMaterial map={labelTexture(l.text)} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
      <AxisName x={data.cx + Math.min(data.R, 9) + 0.9} y={0} text={`${xName} →`} />
      <AxisName x={0} y={data.cy + Math.min(data.R, 9) + 0.9} text={`${yName} ↑`} />
    </group>
  );
}

function AxisName({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <mesh position={[x, 0.01, -y]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.9, 0.9]} />
      <meshBasicMaterial map={labelTexture(text, true)} transparent depthWrite={false} />
    </mesh>
  );
}
