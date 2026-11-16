const GLIDE: [time: number, freq: number][] = [
  [0, 760],
  [0.36, 1480],
  [0.46, 1520],
];
const GAIN = 0.8;
const VIBRATO = { rate: 7, depth: 9 };
const ATTACK = 0.03;
const RELEASE = 0.1;

export function playSiren(ctx: BaseAudioContext, out: AudioNode, at: number) {
  const end = GLIDE[GLIDE.length - 1][0];
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(GLIDE[0][1], at);
  for (const [t, f] of GLIDE.slice(1)) osc.frequency.linearRampToValueAtTime(f, at + t);
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = VIBRATO.rate;
  depth.gain.value = VIBRATO.depth;
  lfo.connect(depth).connect(osc.frequency);
  lfo.start(at);
  lfo.stop(at + end + 0.05);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(GAIN, at + ATTACK);
  env.gain.setValueAtTime(GAIN, at + end - RELEASE);
  env.gain.linearRampToValueAtTime(0, at + end);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + end + 0.02);
}
