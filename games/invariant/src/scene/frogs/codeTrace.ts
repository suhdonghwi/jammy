import { useGame } from '../../game/store';
import type { State } from '../../lang/ast';
import { holds, trace } from '../../lang/eval';
import type { CompiledLevel } from '../../levels/level';
import { after } from '../sceneTime';

const EXIT_PAUSE_MS = 450;

let run = 0;

function substituted(level: CompiledLevel, s: State): string {
  const { guard } = level.program.loop;
  const text = level.program.source.slice(guard.span.from, guard.span.to);
  return text.replace(/\b[A-Za-z_]\w*\b/g, (name) => (typeof s[name] === 'bigint' ? String(s[name]) : name));
}

export function traceHop(level: CompiledLevel, from: State, to: State, dur: number) {
  const id = ++run;
  const live = () => id === run;
  const lines = trace(level.program.loop.body, from);
  const each = (dur * 1000) / Math.max(1, lines.length);
  lines.forEach((span, k) => after(k * each, () => live() && useGame.setState({ codeCursor: { at: span.from, guard: null } })));
  after(dur * 1000, () => {
    if (!live()) return;
    const continues = holds(level.guard, to);
    const guard = { text: substituted(level, to), holds: continues };
    useGame.setState({ codeCursor: { at: level.program.loop.headerSpan.from, guard } });
    const ensures = level.program.ensures[0];
    if (!continues && ensures) after(EXIT_PAUSE_MS, () => live() && useGame.setState({ codeCursor: { at: ensures.span.from, guard } }));
  });
}

export function clearTrace() {
  run++;
  useGame.setState({ codeCursor: null });
}
