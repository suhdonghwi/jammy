type Glide = [time: number, freq: number][];

interface Voice {
  type: OscillatorType;
  glide: Glide;
  gain: number;
  vibrato?: { rate: number; depth: number };
  attack?: number;
  release?: number;
}

function voice(ctx: BaseAudioContext, out: AudioNode, at: number, v: Voice) {
  const end = v.glide[v.glide.length - 1][0];
  const osc = ctx.createOscillator();
  osc.type = v.type;
  osc.frequency.setValueAtTime(v.glide[0][1], at);
  for (const [t, f] of v.glide.slice(1)) osc.frequency.linearRampToValueAtTime(f, at + t);
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
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + end + 0.02);
}

export function playSiren(ctx: BaseAudioContext, out: AudioNode, at: number) {
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
}
