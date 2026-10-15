import { create } from 'zustand';

// The game's sounds: short clips from Kenney's CC0 packs (kenney.nl: Interface
// Sounds, UI Audio, Impact Sounds, Music Jingles), played through Web Audio so
// one clip can vary in pitch and loudness. The files are in src/assets/sfx,
// named by what they are for. A role with no clip is silent (button clicks,
// frogs all stopping, goal pools, egg cracks and proved rules, for now); the
// sound lab can still try clips for them.
//
// Browsers only allow sound after the page has been used, so the audio
// context starts (and the clips load) at the first press or key; anything
// before that is silent.

const MUTE_KEY = 'invariant-frog:muted';

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const useSound = create<{ muted: boolean }>(() => ({
  muted: typeof window === 'undefined' ? false : loadMuted(),
}));

export function setMuted(muted: boolean) {
  useSound.setState({ muted });
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // remembered for this visit only
  }
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
}

const VOLUME = 0.6;

const URLS = import.meta.glob('../assets/sfx/*.m4a', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** What each sound is for; its clip is <role>.m4a (or takes <role>-1.m4a, <role>-2.m4a…). */
export type Role = 'click' | 'hop' | 'land' | 'settle' | 'goal' | 'crack' | 'rise' | 'sink' | 'patter' | 'chime' | 'fail' | 'cleared';

/** Each role's loudness in the mix. */
const GAIN: Record<Role, number> = {
  click: 0.35,
  hop: 0.4,
  land: 0.55,
  settle: 0.25,
  goal: 0.5,
  crack: 0.45,
  rise: 0.35,
  sink: 0.25,
  patter: 0.14,
  chime: 0.35,
  fail: 0.4,
  cleared: 0.45,
};

const takes = new Map<string, AudioBuffer[]>();
const roleOf = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.m4a'.length).replace(/-\d+$/, '');
/** The sound lab's stand-ins (dev only): a role's clips, scaled to its own clips' loudness. */
const overrides = new Map<Role, { bufs: AudioBuffer[]; peak: number }>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function start() {
  if (!ctx) {
    const c = new AudioContext();
    ctx = c;
    // a gentle limiter, so a crowd of frogs never clips
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
  if (ctx.state === 'suspended') void ctx.resume();
}

/** The context, if sound can play right now. */
function live(): AudioContext | null {
  return ctx && ctx.state === 'running' && !useSound.getState().muted ? ctx : null;
}

/**
 * Play one of a role's clips (a random take, so repeats don't sound
 * mechanical): `gain` scales its usual loudness, `rate` speeds it up (and
 * raises its pitch), `at` delays it (seconds).
 */
function play(role: Role, { gain = 1, rate = 1, at = 0, pan = 0 }: { gain?: number; rate?: number; at?: number; pan?: number } = {}) {
  const c = live();
  const o = overrides.get(role);
  const bufs = o ? o.bufs : takes.get(role);
  if (!c || !bufs?.length) return;
  const src = c.createBufferSource();
  src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = GAIN[role] * gain * (o ? matchLoudness(role, o.peak) : 1);
  let node: AudioNode = src.connect(g);
  if (pan) node = node.connect(new StereoPannerNode(c, { pan }));
  node.connect(master!);
  src.start(c.currentTime + at);
}

/** A little random pitch, so repeats don't sound mechanical. */
const wobble = (amount = 0.06) => 1 + (Math.random() * 2 - 1) * amount;
/** The playback rate that raises a clip by `semis` semitones. */
const semitones = (semis: number) => 2 ** (semis / 12);
/** Major pentatonic steps: notes that always agree with each other. */
const PENTA = [0, 2, 4, 7, 9];

/** True at most once per `ms` for a given sound, so a crowd doesn't become a roar. */
const lastAt = new Map<string, number>();
function gap(key: string, ms: number): boolean {
  const now = performance.now();
  if (now - (lastAt.get(key) ?? -Infinity) < ms) return false;
  lastAt.set(key, now);
  return true;
}

// ---------------------------------------------------------------- the sounds

/**
 * Consecutive hops climb the scale, so a running loop sounds like it's going
 * somewhere; a long run stays on the top note (higher, the clip gets squeaky).
 */
const TOP_STEP = 7;
let hopStep = 0;
let lastHop = -Infinity;

export const sfx = {
  /** A button press. */
  click() {
    play('click');
  },

  /** Frogs take off together (`count` of them). */
  hop(count: number) {
    const now = performance.now();
    hopStep = now - lastHop > 1300 ? 0 : Math.min(hopStep + 1, TOP_STEP);
    lastHop = now;
    const semis = PENTA[hopStep % 5] + 12 * Math.floor(hopStep / 5);
    play('hop', { gain: 1 + Math.min(Math.log2(count), 4) * 0.1, rate: semitones(semis) });
  },

  /** They land; `stopped`: none of them will hop again. */
  land(stopped: boolean) {
    play('land', { rate: wobble() });
    if (stopped) play('settle', { at: 0.1 });
  },

  /** A frog arrives in a goal pool: a water drop. */
  goal() {
    if (!gap('goal', 70)) return;
    play('goal', { rate: wobble(0.08) });
  },

  /** An egg cracks and a frog climbs out a moment later. */
  hatch() {
    if (!gap('hatch', 40)) return;
    play('crack', { rate: wobble(0.1) });
    play('hop', { gain: 0.6, rate: semitones(7), at: 0.2 });
  },

  /** The area changed: `rose` slabs came up, `sank` went down. */
  slabs(rose: number, sank: number) {
    if ((!rose && !sank) || !gap('slabs', 120)) return;
    play(rose ? 'rise' : 'sink');
  },

  /** A frog touches down after being dropped: alone a soft thud, in a shower a patter. */
  touch() {
    const alone = gap('touch-alone', 250);
    lastAt.set('touch-alone', performance.now());
    if (alone) return play('land', { gain: 0.9, rate: wobble() });
    if (!gap('patter', 22)) return;
    play('patter', { rate: 1.4 + Math.random() * 0.8, pan: Math.random() * 1.2 - 0.6 });
  },

  /** A rule was proved (`i`: which, so three in a row climb a major chord). */
  pass(i: number) {
    play('chime', { rate: semitones([0, 4, 7][i] ?? 12) });
  },

  /** The scene marks where the area breaks: a short falling tune. */
  fail() {
    play('fail');
  },

  /** The level is cleared: a short rising tune. */
  cleared() {
    play('cleared');
  },
};

// ---------------------------------------------------------------- the sound lab (dev only)

/** Whether the game has a clip of its own for `role` (a role without one is silent). */
export const hasOwnClip = (role: Role) => Object.keys(URLS).some((path) => roleOf(path) === role);

/** Load a clip to audition (starting audio first if it hasn't started). */
export async function loadClip(url: string): Promise<AudioBuffer> {
  start();
  const b = await (await fetch(url)).arrayBuffer();
  return ctx!.decodeAudioData(b);
}

function peak(b: AudioBuffer): number {
  const d = b.getChannelData(0);
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  return m || 1;
}

const ownPeaks = new Map<Role, number>();
/** The gain that brings a stand-in with this peak to the loudness of the role's own clip. */
function matchLoudness(role: Role, standIn: number): number {
  const own = takes.get(role)?.[0];
  if (!own) return 1;
  if (!ownPeaks.has(role)) ownPeaks.set(role, peak(own));
  return ownPeaks.get(role)! / standIn;
}

/** Play `role` with this clip instead of its own, about as loud; null silences it, undefined restores it. */
export function overrideRole(role: Role, buf: AudioBuffer | null | undefined) {
  if (buf === undefined) return void overrides.delete(role);
  overrides.set(role, { bufs: buf ? [buf] : [], peak: buf ? peak(buf) : 1 });
}

/** Play a role once at its usual loudness. */
export function previewRole(role: Role) {
  play(role);
}

if (typeof window !== 'undefined') {
  // the first press or key starts audio; every enabled button clicks
  window.addEventListener('pointerdown', start, { capture: true });
  window.addEventListener('keydown', start, { capture: true });
  window.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element | null)?.closest?.('button:not(:disabled):not([data-silent])')) sfx.click();
    },
    { capture: true },
  );
}
