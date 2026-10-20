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

function noise(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number, from: number, to: number, gain: number) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + dur * 0.3);
  env.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(f).connect(env).connect(out);
  src.start(at);
  src.stop(at + dur);
}

function echo(ctx: BaseAudioContext, out: AudioNode, delay: number, feedback: number): AudioNode {
  const input = ctx.createGain();
  const d = ctx.createDelay(1);
  const fb = ctx.createGain();
  const wet = ctx.createGain();
  d.delayTime.value = delay;
  fb.gain.value = feedback;
  wet.gain.value = 0.35;
  input.connect(out);
  input.connect(d).connect(fb).connect(d);
  d.connect(wet).connect(out);
  return input;
}

export const SIRENS: Siren[] = [
  {
    name: 'Tiny slide',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'sine',
        glide: [
          [0, 760],
          [0.36, 1480],
          [0.46, 1520],
        ],
        gain: 0.8,
        vibrato: { rate: 7, depth: 9 },
        attack: 0.03,
        release: 0.1,
      });
    },
  },
  {
    name: 'Whispered wee-woo',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'sine',
        glide: [
          [0, 820],
          [0.1, 1240],
          [0.2, 860],
          [0.3, 1260],
          [0.42, 1180],
        ],
        gain: 0.7,
        filter: { type: 'lowpass', freq: 2400 },
        attack: 0.03,
        release: 0.12,
      });
    },
  },
  {
    name: 'Bubble up',
    play(ctx, out, at) {
      for (const [t, f0, f1, g] of [
        [0, 380, 1050, 0.6],
        [0.09, 560, 1500, 0.35],
      ] as const) {
        voice(ctx, out, at + t, {
          type: 'sine',
          glide: [
            [0, f0],
            [0.11, f1],
            [0.16, f1],
          ],
          gain: g,
          attack: 0.01,
          release: 0.06,
        });
      }
    },
  },
  {
    name: 'Airy whoosh',
    play(ctx, out, at) {
      noise(ctx, out, at, 0.32, 500, 3200, 3.6);
      voice(ctx, out, at + 0.06, {
        type: 'sine',
        glide: [
          [0, 900],
          [0.24, 1400],
        ],
        gain: 0.25,
        attack: 0.05,
        release: 0.12,
      });
    },
  },
  {
    name: 'Ghost hum',
    play(ctx, out, at) {
      voice(ctx, out, at, {
        type: 'triangle',
        glide: [
          [0, 520],
          [0.22, 740],
          [0.48, 700],
        ],
        gain: 0.8,
        vibrato: { rate: 7, depth: 16 },
        filter: { type: 'lowpass', freq: 1300 },
        attack: 0.08,
        release: 0.2,
      });
    },
  },
  {
    name: 'Glass slide',
    play(ctx, out, at) {
      const wet = echo(ctx, out, 0.11, 0.25);
      voice(ctx, wet, at, {
        type: 'sine',
        glide: [
          [0, 1150],
          [0.22, 1760],
          [0.3, 1800],
        ],
        gain: 0.55,
        attack: 0.02,
        release: 0.12,
      });
      voice(ctx, wet, at, {
        type: 'sine',
        glide: [
          [0, 2300],
          [0.22, 3520],
          [0.3, 3600],
        ],
        gain: 0.12,
        attack: 0.02,
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
