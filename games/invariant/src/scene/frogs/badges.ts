import * as THREE from 'three';

// "×n" badges over tiles crowded with more frogs than fit (see occupancy).

const badgeTextures = new Map<number, THREE.Texture>();
function badgeTexture(n: number): THREE.Texture {
  const hit = badgeTextures.get(n);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(28, 35, 51, 0.9)';
  g.beginPath();
  g.roundRect(4, 8, 152, 80, 40);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '600 52px Fredoka, ui-rounded, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`×${n}`, 80, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  badgeTextures.set(n, t);
  return t;
}
export function placeBadge(sp: THREE.Sprite | null | undefined, x: number, y: number, ground: number, n: number) {
  if (!sp) return;
  sp.visible = true;
  sp.position.set(x, ground + 0.78, -y);
  const m = sp.material as THREE.SpriteMaterial;
  const tex = badgeTexture(n);
  if (m.map !== tex) {
    m.map = tex;
    m.needsUpdate = true;
  }
}
