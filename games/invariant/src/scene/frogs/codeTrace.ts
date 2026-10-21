import { useGame } from '../../game/store';
import type { State } from '../../lang/ast';
import { holds, trace } from '../../lang/eval';
import type { CompiledLevel } from '../../levels/level';
import { after } from '../sceneTime';

const EXIT_PAUSE_MS = 450;

let run = 0;

export function traceHop(level: CompiledLevel, from: State, to: State, dur: number) {
  const id = ++run;
  const live = () => id === run;
  const lines = trace(level.program.loop.body, from);
  const each = (dur * 1000) / Math.max(1, lines.length);
  lines.forEach((span, k) => after(k * each, () => live() && useGame.setState({ codeCursor: { at: span.from, loops: null } })));
  after(dur * 1000, () => {
    if (!live()) return;
    const loops = holds(level.guard, to);
    useGame.setState({ codeCursor: { at: level.program.loop.headerSpan.from, loops } });
    const ensures = level.program.ensures[0];
    if (!loops && ensures) after(EXIT_PAUSE_MS, () => live() && useGame.setState({ codeCursor: { at: ensures.span.from, loops: null } }));
  });
}

export function clearTrace() {
  run++;
  useGame.setState({ codeCursor: null });
}
