import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey, toNum } from '../../levels/level';
import { COLORS } from '../constants';
import { frogGeometry, frogMaterial, ghostDepthMaterial } from '../models';
import { sceneNow } from '../sceneTime';
import { getBlobTexture } from '../shaders/common';
import { placeBadge } from './badges';
import { frogWorld, type FrogSim } from './frogWorld';
import { pose } from './motion';
import { MAX_SHOWN, occupancy, slotFor } from './occupancy';

const MAX_FROGS = 400;
const BADGES = 24;

const dummy = new THREE.Object3D();
const GHOST = new THREE.Color(COLORS.ghostFrog);
const FLOAT = 0.12;
const BOB = 0.035;

const tileOf = (f: FrogSim) => (f.hop ? `${f.hop.tx},${f.hop.ty}` : `${f.x},${f.y}`);

export function Frogs() {
  const body = useRef<THREE.InstancedMesh>(null);
  const ghosts = useRef<THREE.InstancedMesh>(null);
  const ghostDepth = useRef<THREE.InstancedMesh>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => frogGeometry(), []);
  const { ghostGeom, fades } = useMemo(() => {
    const g = geom.clone();
    const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FROGS).fill(1), 1);
    g.setAttribute('aFade', a);
    return { ghostGeom: g, fades: a };
  }, [geom]);
  const mat = useMemo(() => frogMaterial(), []);
  const ghostDepthMat = useMemo(() => ghostDepthMaterial(), []);
  const ghostMat = useMemo(() => {
    const m = frogMaterial({ ghost: true, fade: true });
    m.opacity = 0.8;
    return m;
  }, []);
  const shadowGeom = useMemo(() => new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2), []);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false }),
    [],
  );
  const plane = useGame((s) => planeKey(s.inputs));
  const lastT = useRef<number | undefined>(undefined);
  const badgeRefs = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(() => {
    const b = body.current;
    const gh = ghosts.current;
    const gd = ghostDepth.current;
    const sh = shadows.current;
    if (!b || !gh || !gd || !sh) return;
    const t = sceneNow();
    const visible = frogWorld.frogs.filter((f) => f.plane === plane);
    const groups = new Map<string, FrogSim[]>();
    for (const f of visible) {
      const key = tileOf(f);
      const g = groups.get(key);
      if (g) g.push(f);
      else groups.set(key, [f]);
    }
    let sig = '';
    for (const [k, g] of groups) if (occupancy.eggs.has(k)) sig += `${k}:${g.length}|`;
    if (sig !== occupancy.signature) {
      occupancy.signature = sig;
      occupancy.frogs = new Map([...groups].filter(([k]) => occupancy.eggs.has(k)).map(([k, g]) => [k, g.length]));
      occupancy.version++;
    }
    let n = 0;
    let nReal = 0;
    let nGhost = 0;
    const dt = Math.min(0.1, t - (lastT.current ?? t));
    const k = 1 - Math.exp(-dt * 11);
    lastT.current = t;
    let badges = 0;
    const level = useGame.getState().level;
    for (const f of visible) {
      if (n >= MAX_FROGS) break;
      const p = pose(f, t);
      if (p.landed) {
        const s = toNum(f.state);
        if (level && level.fast.guard(s) !== true && level.fast.post(s) === true) frogWorld.landOnGoal(f, true);
      }
      const key = tileOf(f);
      const g = groups.get(key)!;
      const count = g.length + (occupancy.eggs.has(key) ? 1 : 0);
      const target = slotFor(g.indexOf(f), count);
      if (g.length > MAX_SHOWN && g.indexOf(f) === 0 && badges < BADGES) {
        placeBadge(badgeRefs.current[badges++], f.x, f.y, p.ground, g.length);
      }
      if (f.ox === undefined) {
        f.ox = target.dx;
        f.oy = target.dy;
        f.os = target.scale;
      } else {
        const left = f.hop ? f.hop.t0 + f.hop.dur - t : 0;
        const kk = left > 0 ? Math.min(1, dt / left) : k;
        f.ox += (target.dx - f.ox) * kk;
        f.oy! += (target.dy - f.oy!) * kk;
        f.os! += (target.scale - f.os!) * kk;
      }
      const os = f.os!;
      const px = p.x + f.ox;
      const pz = p.z - f.oy!;
      const ghost = f.kind === 'test';
      const py = ghost ? p.y + FLOAT + BOB * Math.sin(t * 2.6 + f.id * 1.7) : p.y;
      if (!f.drawn) f.drawn = { x: 0, y: 0, ground: 0, z: 0, scale: 1 };
      f.drawn.x = px;
      f.drawn.y = py;
      f.drawn.ground = p.ground;
      f.drawn.z = pz;
      f.drawn.scale = os * Math.max(0, p.sx);
      dummy.position.set(px, py, pz);
      dummy.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
      dummy.scale.set(p.sx * os, p.sy * os, p.sx * os);
      dummy.updateMatrix();
      if (ghost) {
        gd.setMatrixAt(nGhost, dummy.matrix);
        gh.setMatrixAt(nGhost, dummy.matrix);
        fades.setX(nGhost, f.fade ?? 1);
        gh.setColorAt(nGhost++, GHOST);
      } else b.setMatrixAt(nReal++, dummy.matrix);
      const air = Math.max(0, py - p.ground);
      const ss = p.sx <= 0 ? 0 : Math.max(0.35, 1 - air * 0.5) * Math.min(p.sx, 1.2) * os * (ghost ? 0.75 : 1) * p.emerged * (f.fade ?? 1);
      dummy.position.set(px, p.ground + 0.008, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(ss, 1, ss);
      dummy.updateMatrix();
      sh.setMatrixAt(n, dummy.matrix);
      n++;
    }
    for (let i = badges; i < BADGES; i++) {
      const sp = badgeRefs.current[i];
      if (sp) sp.visible = false;
    }
    b.count = nReal;
    gh.count = gd.count = nGhost;
    sh.count = n;
    b.instanceMatrix.needsUpdate = true;
    gh.instanceMatrix.needsUpdate = true;
    gd.instanceMatrix.needsUpdate = true;
    sh.instanceMatrix.needsUpdate = true;
    if (gh.instanceColor) gh.instanceColor.needsUpdate = true;
    fades.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={shadows} args={[shadowGeom, shadowMat, MAX_FROGS]} count={0} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={body} args={[geom, mat, MAX_FROGS]} count={0} frustumCulled={false} onClick={(e) => e.stopPropagation()} />
      <instancedMesh ref={ghostDepth} args={[geom, ghostDepthMat, MAX_FROGS]} count={0} frustumCulled={false} renderOrder={4} />
      <instancedMesh ref={ghosts} args={[ghostGeom, ghostMat, MAX_FROGS]} count={0} frustumCulled={false} renderOrder={5} onClick={(e) => e.stopPropagation()} />
      {Array.from({ length: BADGES }, (_, i) => (
        <sprite key={i} ref={(el) => void (badgeRefs.current[i] = el)} visible={false} scale={[0.5, 0.3, 1]} renderOrder={10}>
          <spriteMaterial depthTest={false} transparent />
        </sprite>
      ))}
    </group>
  );
}
