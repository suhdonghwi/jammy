import { useGame } from '../game/store';
import type { State } from '../lang/ast';
import { holds, trace } from '../lang/eval';
import type { CompiledLevel } from '../levels/level';
import { BEAT, ms } from '../motion';
import { after } from '../scene/sceneTime';

const ENSURES_AFTER_MS = ms(BEAT);

let run = 0;

export function traceHop(level: CompiledLevel, from: State, to: State, dur: number) {
  const id = ++run;
  const live = () => id === run;
  const lines = trace(level.program.loop.body, from);
  const each = (dur * 1000) / (lines.length + 1);
  lines.forEach((span, k) => after(k * each, () => live() && useGame.setState({ codeCursor: { at: span.from, loops: null } })));
  const loops = holds(level.guard, to);
  after(lines.length * each, () => live() && useGame.setState({ codeCursor: { at: level.program.loop.headerSpan.from, loops } }));
  const { ensures } = level.program;
  if (!loops && ensures.length) {
    const block = { at: ensures[0].span.from, until: ensures[ensures.length - 1].span.to, loops: null };
    after(ms(dur) + ENSURES_AFTER_MS, () => live() && useGame.setState({ codeCursor: block }));
  }
}

export function clearTrace() {
  run++;
  useGame.setState({ codeCursor: null });
}
