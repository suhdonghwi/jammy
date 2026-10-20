export interface Siren {
  name: string;
  play(ctx: BaseAudioContext, out: AudioNode, at: number): void;
}

type Glide = [time: number, freq: number][];

interface Voice {
  type: OscillatorType;
  glide: Glide;
  gain: number;
  vibrato?: { rate: number; depth: number };
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  attack?: number;
  release?: number;
  step?: boolean;
}

function voice(ctx: BaseAudioContext, out: AudioNode, at: number, v: Voice) {
  const end = v.glide[v.glide.length - 1][0];
  const osc = ctx.createOscillator();
  osc.type = v.type;
  osc.frequency.setValueAtTime(v.glide[0][1], at);
  for (const [t, f] of v.glide.slice(1)) {
    if (v.step) osc.frequency.setValueAtTime(f, at + t);
    else osc.frequency.linearRampToValueAtTime(f, at + t);
  }
  if (v.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = v.vibrato.rate;
    depth.gain.value = v.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + end + 0.05);
  }
  const env = ctx.createGain();
  const attack = v.attack ?? 0.02;
  const release = v.release ?? 0.08;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(v.gain, at + attack);
  env.gain.setValueAtTime(v.gain, at + end - release);
  env.gain.linearRampToValueAtTime(0, at + end);
  let node: AudioNode = osc;
  if (v.filter) {
    const f = ctx.createBiquadFilter();
    f.type = v.filter.type;
    f.frequency.value = v.filter.freq;
    f.Q.value = v.filter.q ?? 0.8;
    node = node.connect(f);
  }
  node.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + end + 0.02);
}

function twoTone(hi: number, lo: number, half: number, cycles: number): Glide {
  const g: Glide = [];
  for (let k = 0; k < cycles * 2; k++) {
    const f = k % 2 === 0 ? hi : lo;
    g.push([k * half, f], [(k + 1) * half - 0.001, f]);
  }
  return g;
}

function echo(ctx: BaseAudioContext, out: AudioNode, delay: number, feedback: number): AudioNode {
  const input = ctx.createGain();
  const d = ctx.createDelay(1);
  const fb = ctx.createGain();
  const wet = ctx.createGain();
  d.delayTime.value = delay;
  fb.gain.value = feedback;
  wet.gain.value = 0.45;
  input.connect(out);
  input.connect(d).connect(fb).connect(d);
  d.connect(wet).connect(out);
  return input;
}

export const SIRENS: Siren[] = [
  {
    name: 'Toy nee-naw',
    play(ctx, out, at) {
      voice(ctx, out, at, { type: 'triangle', glide: twoTone(980, 760, 0.2, 2), gain: 0.9, vibrato: { rate: 9, depth: 14 }, filter: { type: 'lowpass', freq: 3200 } });
    },
  },
  {
    name: 'Ghostly woo-ee',
    play(ctx, out, at) {
      const wet = echo(ctx, out, 0.16, 0.35);
      voice(ctx, wet, at, {
        type: 'sine',
        glide: [
          [0, 520],
          [0.22, 880],
          [0.42, 600],
          [0.64, 900],
          [0.95, 480],
        ],
        gain: 0.85,
        vibrato: { rate: 6.5, depth: 22 },
        attack: 0.06,
        release: 0.25,
      });
    },
  },
  {
    name: 'Little wail',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'sine',
        glide: [
          [0, 620],
          [0.35, 1250],
          [0.7, 620],
          [1.0, 1100],
        ],
        gain: 0.8,
        vibrato: { rate: 11, depth: 10 },
        release: 0.18,
      });
      voice(ctx, out, at, {
        type: 'triangle',
        glide: [
          [0, 310],
          [0.35, 625],
          [0.7, 310],
          [1.0, 550],
        ],
        gain: 0.25,
        release: 0.18,
      });
    },
  },
  {
    name: 'Chiptune',
    play(ctx, out, at) {
      const glide: Glide = [];
      const notes = [1175, 880, 1175, 880];
      notes.forEach((f, k) => {
        for (let j = 0; j < 4; j++) glide.push([k * 0.16 + j * 0.04, j % 2 ? f * 1.5 : f]);
      });
      glide.push([0.64, 880]);
      voice(ctx, out, at, { type: 'square', glide, gain: 0.32, step: true, filter: { type: 'lowpass', freq: 5000 }, attack: 0.005, release: 0.04 });
    },
  },
  {
    name: 'Kazoo',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'sawtooth',
        glide: twoTone(560, 440, 0.21, 2),
        gain: 0.55,
        vibrato: { rate: 7, depth: 9 },
        filter: { type: 'bandpass', freq: 1300, q: 1.6 },
        attack: 0.03,
      });
    },
  },
  {
    name: 'Slide whistle',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'sine',
        glide: [
          [0, 700],
          [0.18, 1400],
          [0.36, 900],
          [0.54, 1500],
          [0.8, 1700],
        ],
        gain: 0.7,
        vibrato: { rate: 5, depth: 6 },
        attack: 0.03,
        release: 0.12,
      });
    },
  },
];

const KEY = 'invariant-frog:siren';
export const DEFAULT_SIREN = 0;

export function chosenSiren(): number {
  if (!import.meta.env.DEV || typeof window === 'undefined') return DEFAULT_SIREN;
  const fromUrl = new URLSearchParams(location.search).get('siren');
  try {
    if (fromUrl !== null) localStorage.setItem(KEY, fromUrl);
    const n = Number(localStorage.getItem(KEY) ?? DEFAULT_SIREN);
    return Number.isInteger(n) && n >= 0 && n < SIRENS.length ? n : DEFAULT_SIREN;
  } catch {
    return DEFAULT_SIREN;
  }
}
