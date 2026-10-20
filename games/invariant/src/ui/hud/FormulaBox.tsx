import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { check } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { displayNames } from '../../levels/level';
import { button } from '../classes';
import { colorRuns } from '../codeColors';
import { RuleLights } from './RuleLights';

const ERROR_MARK = 'underline decoration-fail decoration-wavy underline-offset-4';

function colored(text: string, error: { from: number; to: number } | null): ReactNode[] {
  let err: { from: number; to: number } | null = null;
  if (error) {
    const from = Math.min(error.from, text.length);
    const to = Math.min(Math.max(error.to, from + 1), text.length);
    if (from < to) err = { from, to };
  }
  const out: ReactNode[] = [];
  for (const r of colorRuns(text)) {
    const cuts = [r.from, r.to];
    if (err) for (const c of [err.from, err.to]) if (c > r.from && c < r.to) cuts.splice(-1, 0, c);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const [from, to] = [cuts[i], cuts[i + 1]];
      const marked = err && from >= err.from && to <= err.to;
      const cls = marked ? `${r.cls} ${ERROR_MARK}` : r.cls;
      out.push(cls ? <span key={from} className={cls}>{text.slice(from, to)}</span> : text.slice(from, to));
    }
  }
  return out;
}

const TEXT = 'col-start-1 row-start-1 m-0 min-w-0 px-1 py-2.5 font-mono text-(length:--formula-size) leading-[1.4] whitespace-pre-wrap [overflow-wrap:anywhere]';

export function FormulaBox() {
  const level = useGame((s) => s.level);
  const names = useMemo(() => (level ? displayNames(level) : []), [level]);
  const formula = useGame((s) => s.formula);
  const formulaText = useGame((s) => s.formulaText);
  const busy = useGame((s) => s.busy);
  const checking = useGame((s) => s.checking);
  const mode = useGame((s) => s.mode);
  const awaitingCheck = useGame((s) => s.awaitingCheck);
  const locked = useGame((s) => s.mode === 'tutorial' && !s.tutorialAllow.formula);
  const spot = useGame((s) => s.spotlight);
  const tr = useT();
  const [shownError, setShownError] = useState<{ message: string; span: { from: number; to: number } } | null>(null);
  const errorNudge = useGame((s) => s.errorNudge);
  const [shake, setShake] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!checking) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 450);
    return () => clearTimeout(t);
  }, [checking]);
  useEffect(() => setShownError(null), [formula]);
  useEffect(() => {
    if (!errorNudge) return;
    const f = useGame.getState().formula;
    if (f && !f.ok) setShownError({ message: f.error.message, span: f.error.span });
    setShake(true);
    const t = setTimeout(() => setShake(false), 340);
    return () => clearTimeout(t);
  }, [errorNudge]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void check();
    }
  };
  const placeholder = tr.formula.placeholder(names.join(', '));

  const canCheck = !busy && !checking && (mode !== 'tutorial' || awaitingCheck);
  return (
    // 16px on phones: any smaller and iOS zooms the page when the box is focused
    <div className="animate-[rise_0.4s_ease-out] [--formula-size:17px] max-sm:[--formula-size:16px]">
      <div
        className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-2xl border-2 bg-white py-1.25 pr-1.5 pl-4 shadow-card max-sm:gap-x-2 max-sm:pl-3 transition-colors duration-150 ${shownError ? 'border-fail/50' : 'border-brand/30 focus-within:border-brand/65'} ${spot === 'formula' ? 'spotlight' : ''} ${shake ? 'animate-shake' : ''}`}
      >
        <span className="flex items-center gap-1.75 font-display text-xs font-semibold tracking-[0.08em] text-brand uppercase before:size-3 before:-translate-y-px before:rounded-sm before:bg-slab before:shadow-[0_2px_0_var(--color-slab-side)]">
          <span className="max-sm:sr-only">{tr.formula.area}</span>
        </span>
        <div className={`grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] ${locked ? 'cursor-default opacity-60' : ''}`}>
          <div aria-hidden className={`${TEXT} pointer-events-none text-ink`}>
            {formulaText ? colored(formulaText, shownError?.span ?? null) : <span className="font-sans text-[0.9em] text-[#a8afbb]">{placeholder}</span>}
            {'\u200b'}
          </div>
          <textarea
            className={`${TEXT} w-full resize-none overflow-hidden border-0 bg-transparent text-transparent caret-ink outline-none selection:bg-brand/20 placeholder:text-transparent ${locked ? 'cursor-default' : ''}`}
            rows={1}
            value={formulaText}
            placeholder={placeholder}
            aria-label={tr.formula.area}
            readOnly={locked}
            tabIndex={locked ? -1 : 0}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            onChange={(e) => useGame.getState().setFormula(e.target.value.replace(/\r?\n/g, ' '))}
            onKeyDown={onKeyDown}
          />
        </div>
        {shownError && (
          <span className="order-last mr-1.5 mb-1 basis-full animate-fade rounded-lg bg-[#fff1f0] px-2.5 py-1 text-xs leading-normal text-[#b42318]">
            {shownError.message}
          </span>
        )}
        <div className="order-last -ml-1 mb-0.5 basis-full empty:hidden">
          <RuleLights />
        </div>
        <button
          className={`${button('check', 'none')} ${spot === 'check' ? 'spotlight spotlight-glow' : ''}`}
          disabled={!canCheck}
          onClick={() => void check()}
        >
          {slow ? <LoaderCircle size={16} strokeWidth={2.6} className="animate-spin" /> : <Check size={16} strokeWidth={2.8} />}
          {tr.formula.check}
        </button>
      </div>
    </div>
  );
}
