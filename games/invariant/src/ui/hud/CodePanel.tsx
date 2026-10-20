import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../game/store';
import { PHONE, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { planeExists, type CompiledLevel } from '../../levels/level';
import { CARD, CARD_LABEL } from '../classes';
import { HighlightedCode } from '../codeColors';
import { inputRows, InputsSection } from './Inputs';

const ROW = '-mx-4 flex px-4 max-md:-mx-2.5 max-md:px-2.5';

const LANDED = {
  true: 'animate-[check-true_0.9s_ease-out]',
  false: 'animate-[check-false_1.4s_ease-out_forwards]',
  mixed: 'animate-[check-mixed_0.9s_ease-out]',
};

interface Beat {
  hopTick: number;
  hopDur: number;
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
  assert: boolean;
  spotLines: number[];
  inputHover: string | null;
  impossible: boolean;
}

function highlightSource(level: CompiledLevel, beat: Beat) {
  const src = level.program.source;
  const header = level.program.loop.headerSpan;
  const stmts = level.program.loop.body;
  const lines: { from: number; to: number }[] = [];
  for (let from = 0; ; ) {
    const k = src.indexOf('\n', from);
    lines.push({ from, to: k < 0 ? src.length : k });
    if (k < 0) break;
    from = k + 1;
  }
  const lineOf = (pos: number) => lines.findIndex((l) => pos >= l.from && pos <= l.to);
  const headerLine = lineOf(header.from);
  const hoverLine = beat.inputHover ? lineOf(level.program.inputDecls.find((d) => d.name === beat.inputHover)?.span.from ?? -1) : -1;
  const requiresLines = beat.impossible ? level.program.requires.map((r) => lineOf(r.span.from)) : [];
  const bodyFirst = stmts.length ? lineOf(stmts[0].span.from) : -1;
  const bodyLast = stmts.length ? lineOf(stmts[stmts.length - 1].span.to) : -2;
  const rows = lines.map((l, i) => {
    let cls = `${ROW} min-h-lh`;
    let key = `l${i}`;
    let style: React.CSSProperties | undefined;
    if (i === headerLine) {
      cls += ` ${beat.landTick > 0 ? LANDED[beat.landGuard] : ''}`;
      key += `h${beat.landTick}`;
    } else if (i >= bodyFirst && i <= bodyLast) {
      key += `b${beat.hopTick}`;
      if (beat.hopTick > 0) style = { animation: `body-run ${Math.max(0.3, beat.hopDur + 0.15)}s ease-out` };
    }
    if (beat.spotLines.includes(i + 1) || i === hoverLine) cls += ' bg-brand-soft';
    if (requiresLines.includes(i)) cls += ' bg-warn-soft';
    return (
      <div key={key} className={cls} style={style}>
        <span>
          <HighlightedCode src={src.slice(l.from, l.to)} />
        </span>
      </div>
    );
  });
  if (beat.assert && headerLine >= 0) {
    const indent = stmts.length ? src.slice(lines[bodyFirst].from).match(/^\s*/)?.[0] ?? '  ' : '  ';
    rows.splice(headerLine + 1, 0, (
      <div key="assert" className={`${ROW} text-faint`}>
        <span>
          {indent}
          <span className="font-semibold">assert</span>(?);
        </span>
      </div>
    ));
  }
  return rows;
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const hopTick = useGame((s) => s.hopTick);
  const hopDur = useGame((s) => s.hopDur);
  const landTick = useGame((s) => s.landTick);
  const landGuard = useGame((s) => s.landGuard);
  const shown = useGame((s) => s.reveal.code);
  const spotLines = useGame((s) => s.spotLines);
  const assert = useGame((s) => s.reveal.assert);
  const inputHover = useGame((s) => s.inputHover);
  const impossible = useGame((s) => !planeExists(level, s.inputs));
  const nodes = useMemo(
    () => highlightSource(level, { hopTick, hopDur, landTick, landGuard, assert, spotLines, inputHover, impossible }),
    [level, hopTick, hopDur, landTick, landGuard, assert, spotLines, inputHover, impossible],
  );
  const spot = useGame((s) => s.spotlight);
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const phone = useMedia(PHONE);
  const [folded, setFolded] = useState<boolean | null>(null);
  const tr = useT();
  useEffect(() => setFolded(null), [level]);
  const pointedAt = spot === 'code' || spotLines.length > 0 || (tutorial && phone && spot === 'step');
  const open = pointedAt || !(folded ?? (tutorial && phone));
  const hasInputs = inputRows(level).length > 0;
  if (!shown) return null;
  return (
    <div
      data-frame="top"
      className={`${CARD} flex min-h-0 animate-slide-in px-4 pt-3.25 pb-3 max-md:p-2.5 ${open ? 'flex-col' : 'flex-wrap items-center gap-x-3 gap-y-2'} ${spot === 'code' ? 'spotlight' : ''}`}
    >
      <button
        className={`${CARD_LABEL} -mx-1.5 -mt-1 flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-shade/6 hover:text-muted ${open ? 'mb-0.5! self-start' : '-mb-1!'}`}
        aria-expanded={open}
        onClick={() => setFolded(open)}
      >
        {tr.code.title}
        <ChevronDown size={14} strokeWidth={2.6} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <pre
          className={`m-0 -mx-4 min-h-0 overflow-auto px-4 max-md:-mx-2.5 max-md:px-2.5 ${hasInputs ? 'pb-2.5 max-md:pb-2' : '-mb-3 rounded-b-2xl pb-3 max-md:-mb-2.5 max-md:pb-2.5'} font-mono text-sm leading-[1.62] whitespace-pre text-[#4a5368] max-md:text-[11px]`}
        >
          {nodes}
        </pre>
      )}
      <InputsSection key={level.id} inline={!open} />
    </div>
  );
}
