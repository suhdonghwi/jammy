import { create } from 'zustand';
import { storage } from '../storage';
import { playSiren } from './sirens';

const MUTE_KEY = 'invariant-frog:muted';

export const useSound = create<{ muted: boolean }>(() => ({ muted: storage.get(MUTE_KEY) === '1' }));

export function setMuted(muted: boolean) {
  useSound.setState({ muted });
  storage.set(MUTE_KEY, muted ? '1' : null);
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
}

const VOLUME = 0.6;
const SIREN_GAIN = 0.06;
const TICK_GAIN = 0.05;
const TICK_BASE = 1000;
const LANDING_GAIN = 0.05;

const URLS = import.meta.glob('../assets/sfx/*.m4a', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

type Role = 'click' | 'hop' | 'land' | 'settle' | 'goal' | 'crack' | 'rise' | 'sink' | 'chime' | 'fail' | 'cleared';

const GAIN: Record<Role, number> = {
  click: 0.35,
  hop: 0.4,
  land: 0.55,
  settle: 0.25,
  goal: 0.5,
  crack: 0.45,
  rise: 0.35,
  sink: 0.25,
  chime: 0.35,
  fail: 0.4,
  cleared: 0.45,
};

const takes = new Map<string, AudioBuffer[]>();
const roleOf = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.m4a'.length).replace(/-\d+$/, '');

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function prepareSound() {
  if (!ctx) {
    const c = new AudioContext();
    ctx = c;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    master = c.createGain();
    master.gain.value = useSound.getState().muted ? 0 : VOLUME;
    master.connect(comp).connect(c.destination);
    for (const [path, url] of Object.entries(URLS)) {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => c.decodeAudioData(b))
        .then((buf) => {
          const role = roleOf(path);
          takes.set(role, [...(takes.get(role) ?? []), buf]);
        })
        .catch(() => {});
    }
  }
}

function start() {
  prepareSound();
  if (ctx!.state !== 'running') void ctx!.resume();
}

function live(): AudioContext | null {
  return ctx && ctx.state === 'running' && !useSound.getState().muted ? ctx : null;
}

function play(role: Role, { gain = 1, rate = 1, at = 0, pan = 0 }: { gain?: number; rate?: number; at?: number; pan?: number } = {}) {
  const c = live();
  const bufs = takes.get(role);
  if (!c || !bufs?.length) return;
  const src = c.createBufferSource();
  src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = GAIN[role] * gain;
  let node: AudioNode = src.connect(g);
  if (pan) node = node.connect(new StereoPannerNode(c, { pan }));
  node.connect(master!);
  src.start(c.currentTime + at);
}

const wobble = (amount = 0.06) => 1 + (Math.random() * 2 - 1) * amount;
const semitones = (semis: number) => 2 ** (semis / 12);
const PENTA = [0, 2, 4, 7, 9];

const lastAt = new Map<string, number>();
function gap(key: string, ms: number): boolean {
  const now = performance.now();
  if (now - (lastAt.get(key) ?? -Infinity) < ms) return false;
  lastAt.set(key, now);
  return true;
}

const TOP_STEP = 7;
let hopStep = 0;
let lastHop = -Infinity;

export const sfx = {
  click() {
    play('click');
  },

  hop(count: number) {
    const now = performance.now();
    hopStep = now - lastHop > 1300 ? 0 : Math.min(hopStep + 1, TOP_STEP);
    lastHop = now;
    const semis = PENTA[hopStep % 5] + 12 * Math.floor(hopStep / 5);
    play('hop', { gain: 1 + Math.min(Math.log2(count), 4) * 0.1, rate: semitones(semis) });
  },

  land(stopped: boolean) {
    play('land', { rate: wobble() });
    if (stopped) play('settle', { at: 0.1 });
  },

  goal() {
    if (!gap('goal', 70)) return;
    play('goal', { rate: wobble(0.08) });
  },

  hatch() {
    if (!gap('hatch', 40)) return;
    play('crack', { rate: wobble(0.1) });
    play('hop', { gain: 0.6, rate: semitones(7), at: 0.2 });
  },

  slabs(rose: number, sank: number) {
    if ((!rose && !sank) || !gap('slabs', 120)) return;
    play(rose ? 'rise' : 'sink');
  },

  pass(i: number) {
    play('chime', { rate: semitones([0, 4, 7][i] ?? 12) });
  },

  fail() {
    play('fail');
  },

  cleared() {
    play('cleared');
  },

  ticks(offsets: readonly number[]) {
    const c = live();
    if (!c) return;
    offsets.forEach((offset, step) => {
      const at = c.currentTime + Math.max(0, offset);
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = TICK_BASE * semitones(PENTA[step % 5] + 12 * Math.floor(step / 5));
      const g = c.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(TICK_GAIN, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
      osc.connect(g).connect(master!);
      osc.start(at);
      osc.stop(at + 0.08);
    });
  },

  landing() {
    const c = live();
    if (!c || !gap('landing', 120)) return;
    const at = c.currentTime;
    for (const [f, delay] of [
      [1568, 0],
      [2349, 0.07],
    ] as const) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, at + delay);
      g.gain.linearRampToValueAtTime(LANDING_GAIN, at + delay + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + delay + 0.18);
      osc.connect(g).connect(master!);
      osc.start(at + delay);
      osc.stop(at + delay + 0.2);
    }
  },

  ghost() {
    const c = live();
    if (!c || !gap('ghost', 700)) return;
    const g = c.createGain();
    g.gain.value = SIREN_GAIN;
    g.connect(master!);
    playSiren(c, g, c.currentTime + 0.02);
  },
};

if (typeof window !== 'undefined') {
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, start, { capture: true });
  }
  window.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.('button:not(:disabled):not([data-silent])')) sfx.click();
    },
    { capture: true },
  );
}
