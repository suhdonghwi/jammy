import { useGame } from '../game/store';
import { withLengths, type Inputs } from '../levels/inputs';
import { BASE, BEAT, MICRO, ms, SHORT } from '../motion';
import { sleep } from '../scene/sceneTime';
import { currentLevel, type Token } from './sequence';

const CLICKS_UP_TO = 3;
const TYPE_KEY_MS = 55;
const APPEAR_OFFSET = { x: 36, y: 52 };
const FIELD_INSET = 5;

type Value = Inputs[string];

const text = (v: Value) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v));

function spot(key: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-ghost="${CSS.escape(key)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return null;
  if (el instanceof HTMLInputElement) return { x: r.right - FIELD_INSET, y: r.bottom - FIELD_INSET };
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function glideTo(key: string): Promise<boolean> {
  const p = spot(key);
  if (!p) return false;
  if (!useGame.getState().ghost) {
    useGame.setState({ ghost: { x: p.x + APPEAR_OFFSET.x, y: p.y + APPEAR_OFFSET.y, target: null, down: false } });
    await sleep(ms(SHORT));
  }
  useGame.setState({ ghost: { x: p.x, y: p.y, target: null, down: false } });
  await sleep(ms(BASE));
  return true;
}

async function press(key: string, shown: boolean) {
  if (!shown) return;
  useGame.setState((g) => ({ ghost: g.ghost && { ...g.ghost, target: key, down: true } }));
  await sleep(ms(MICRO));
  useGame.setState((g) => ({ ghost: g.ghost && { ...g.ghost, down: false } }));
}

function plan(from: Value, to: Value): { key: 'inc' | 'dec'; times: number } | null {
  if (typeof from !== 'number' || typeof to !== 'number') return null;
  const d = to - from;
  return Math.abs(d) <= CLICKS_UP_TO ? { key: d > 0 ? 'inc' : 'dec', times: Math.abs(d) } : null;
}

export async function adjustInputs(tok: Token, target: Inputs): Promise<boolean> {
  const L = currentLevel();
  const lengths = new Set(Object.values(L.arrays));
  let now = useGame.getState().inputs;
  const names = Object.keys(target).filter((n) => !lengths.has(n) && text(now[n]) !== text(target[n]));
  if (!names.length) return false;
  const set = (name: string, v: Value) => {
    now = withLengths(L, { ...now, [name]: v });
    useGame.setState({ inputs: now });
  };
  try {
    for (const name of names) {
      const clicks = plan(now[name], target[name]);
      const key = `${name}:${clicks ? clicks.key : 'field'}`;
      useGame.setState({ inputCue: name });
      const shown = await glideTo(key);
      if (!tok.alive) return true;
      if (clicks) {
        for (let k = 0; k < clicks.times; k++) {
          await press(key, shown);
          set(name, (now[name] as number) + (clicks.key === 'inc' ? 1 : -1));
          await sleep(ms(BEAT));
          if (!tok.alive) return true;
        }
      } else {
        await press(key, shown);
        const typed = text(target[name]);
        for (let k = 0; k <= typed.length; k++) {
          useGame.setState({ inputDraft: { name, text: typed.slice(0, k) } });
          await sleep(TYPE_KEY_MS);
          if (!tok.alive) return true;
        }
        useGame.setState({ inputDraft: null });
        set(name, target[name]);
        await sleep(ms(BEAT));
        if (!tok.alive) return true;
      }
      useGame.setState({ inputCue: null });
    }
  } finally {
    useGame.setState({ ghost: null, inputCue: null, inputDraft: null });
  }
  return true;
}
