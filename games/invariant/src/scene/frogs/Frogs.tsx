import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { toNum } from '../../levels/level';
import { COLORS } from '../constants';
import { goalEvents } from '../goalEvents';
import { frogGeometry, frogMaterial } from '../models';
import { sceneNow } from '../sceneTime';
import { getBlobTexture } from '../shaders/common';
import { placeBadge } from './badges';
import { frogWorld, type FrogSim } from './frogWorld';
import { pose } from './motion';
import { MAX_SHOWN, occupancy, slotFor } from './occupancy';

// Every frog in one instanced draw (plus their shadows). Frogs sharing a tile
// move into slots, and a crowded tile gets a "×n" badge.

const MAX_FROGS = 400;
const BADGES = 24;

/** Frogs that touched down this frame after being dropped (for goal ripples). */
const dropLandings: FrogSim[] = [];

const dummy = new THREE.Object3D();
const col = new THREE.Color();
const C = {
  real: new THREE.Color(COLORS.frog),
  test: new THREE.Color(COLORS.testFrog),
};

/** The tile a frog is on, or is landing on. */
const tileOf = (f: FrogSim) => (f.hop ? `${f.hop.tx},${f.hop.ty}` : `${f.x},${f.y}`);

export function Frogs() {
  const body = useRef<THREE.InstancedMesh>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => frogGeometry(), []);
  const mat = useMemo(() => frogMaterial(), []);
  const shadowGeom = useMemo(() => new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2), []);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false }),
    [],
  );
  const pond = useGame((s) => s.pond);
  const hasPonds = useGame((s) => !!s.level?.pond);
  const visibleList = useRef<FrogSim[]>([]);
  const lastT = useRef<number | undefined>(undefined);
  const badgeRefs = useRef<(THREE.Sprite | null)[]>([]);
  // nothing renders until the first frame has placed every instance
  useLayoutEffect(() => {
    for (const r of [body, shadows]) if (r.current) r.current.count = 0;
  }, []);

  useFrame(() => {
    const b = body.current;
    const sh = shadows.current;
    if (!b || !sh) return;
    const t = sceneNow();
    // Which frogs share which tile (for slot layout). A hopping frog already
    // counts on the tile it is landing on, so the frogs there make room while
    // it is in the air and it touches down straight into its own slot.
    const visible = frogWorld.frogs.filter((f) => !hasPonds || f.pond === pond);
    const groups = new Map<string, FrogSim[]>();
    for (const f of visible) {
      if (f.carried !== undefined) continue;
      const key = tileOf(f);
      const g = groups.get(key);
      if (g) g.push(f);
      else groups.set(key, [f]);
    }
    const sig = [...groups].map(([k, g]) => `${k}:${g.length}`).join('|');
    if (sig !== occupancy.signature) {
      occupancy.signature = sig;
      occupancy.frogs = new Map([...groups].map(([k, g]) => [k, g.length]));
      occupancy.version++;
    }
    let n = 0;
    const list: FrogSim[] = [];
    const dt = Math.min(0.1, t - (lastT.current ?? t));
    const k = 1 - Math.exp(-dt * 11);
    lastT.current = t;
    let badges = 0;
    for (const f of visible) {
      if (n >= MAX_FROGS) break;
      const p = pose(f, t);
      if (p.landed) dropLandings.push(f);
      // slot within a shared tile; glide toward it so nothing pops
      let target = { dx: 0, dy: 0, scale: 1 };
      if (f.carried === undefined) {
        const key = tileOf(f);
        const g = groups.get(key)!;
        const count = g.length + (occupancy.eggs.has(key) ? 1 : 0);
        target = slotFor(g.indexOf(f), count);
        if (g.length > MAX_SHOWN && g.indexOf(f) === 0 && badges < BADGES) {
          placeBadge(badgeRefs.current[badges++], f.x, f.y, p.ground, g.length);
        }
      }
      if (f.ox === undefined) {
        f.ox = target.dx;
        f.oy = target.dy;
        f.os = target.scale;
      } else {
        // in the air: arrive at the slot exactly on landing; otherwise glide
        const left = f.hop ? f.hop.t0 + f.hop.dur - t : 0;
        const kk = left > 0 ? Math.min(1, dt / left) : k;
        f.ox += (target.dx - f.ox) * kk;
        f.oy! += (target.dy - f.oy!) * kk;
        f.os! += (target.scale - f.os!) * kk;
      }
      const os = f.os!;
      const px = p.x + f.ox;
      const pz = p.z - f.oy!;
      if (!f.drawn) f.drawn = { x: 0, y: 0, ground: 0, z: 0, scale: 1 };
      f.drawn.x = px;
      f.drawn.y = p.y;
      f.drawn.ground = p.ground;
      f.drawn.z = pz;
      f.drawn.scale = os * Math.max(0, p.sx);
      dummy.position.set(px, p.y, pz);
      dummy.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
      dummy.scale.set(p.sx * os, p.sy * os, p.sx * os);
      dummy.updateMatrix();
      b.setMatrixAt(n, dummy.matrix);
      col.copy(f.kind === 'real' ? C.real : C.test);
      b.setColorAt(n, col);
      // the shadow shrinks as the frog rises
      const air = Math.max(0, p.y - p.ground);
      const ss = p.sx <= 0 ? 0 : Math.max(0.35, 1 - air * 0.5) * Math.min(p.sx, 1.2) * os;
      dummy.position.set(px, p.ground + 0.008, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(ss, 1, ss);
      dummy.updateMatrix();
      sh.setMatrixAt(n, dummy.matrix);
      list.push(f);
      n++;
    }
    const level = useGame.getState().level;
    if (level) {
      for (const f of dropLandings) {
        if (level.fast.guard(toNum(f.state)) !== true && level.fast.post(toNum(f.state)) === true) {
          goalEvents.push(f.x, f.y, f.pond);
          f.cheerT0 = sceneNow();
        }
      }
    }
    dropLandings.length = 0;
    for (let i = badges; i < BADGES; i++) {
      const sp = badgeRefs.current[i];
      if (sp) sp.visible = false;
    }
    visibleList.current = list;
    b.count = sh.count = n;
    b.instanceMatrix.needsUpdate = true;
    sh.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={shadows} args={[shadowGeom, shadowMat, MAX_FROGS]} frustumCulled={false} renderOrder={3} />
      {/* a click on a frog isn't a click on the tile (or egg) under it */}
      <instancedMesh ref={body} args={[geom, mat, MAX_FROGS]} frustumCulled={false} onClick={(e) => e.stopPropagation()} />
      {Array.from({ length: BADGES }, (_, i) => (
        <sprite key={i} ref={(el) => void (badgeRefs.current[i] = el)} visible={false} scale={[0.5, 0.3, 1]} renderOrder={10}>
          <spriteMaterial depthTest={false} transparent />
        </sprite>
      ))}
    </group>
  );
}
