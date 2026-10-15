import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { displayNames, RULE_NAMES, showState, type CompiledLevel, type Rule } from '../levels/level';
import { useGame } from '../store/game';
import { director } from '../director/director';
import { goMenu } from '../director/play';
import { tokenize } from '../lang/parser';
import { useHover } from '../scene/hover';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Wand2,
} from 'lucide-react';
import { tileState } from '../scene/tiles';
import { Markdown } from './Markdown';
import { useLingering, usePresence } from './presence';

// ---------------------------------------------------------------------------
// Code panel: the program, with the loop header lighting up on each landing
// and the selected frog's values shown like a debugger.
// ---------------------------------------------------------------------------

const KW = new Set(['input', 'var', 'requires', 'ensures', 'while', 'if', 'else', 'true', 'false', 'abs', 'min', 'max']);

interface Beat {
  hopTick: number;
  hopDur: number;
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
}

/**
 * Syntax-highlighted program, one row per line with line numbers. While frogs
 * hop, the loop body's lines light up (that is what a hop runs); when they
 * land, the condition's line flashes green (keep looping) or amber (stop).
 * Highlights cover whole rows, so they all share the same width.
 */
function highlightSource(level: CompiledLevel, beat: Beat) {
  const src = level.program.source;
  const header = level.program.loop.headerSpan;
  const stmts = level.program.loop.body;
  const toks = tokenize(src).filter((t) => t.kind !== 'eof');
  const piece = (from: number, to: number, keyBase: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let p = from;
    toks.forEach((t, i) => {
      if (t.span.from < from || t.span.to > to) return;
      if (t.span.from > p) out.push(<Fragment key={`${keyBase}g${i}`}>{src.slice(p, t.span.from)}</Fragment>);
      const cls = t.kind === 'num' ? 'tok-num' : t.kind === 'ident' ? (KW.has(t.text) ? 'tok-kw' : 'tok-var') : 'tok-op';
      out.push(
        <span key={`${keyBase}t${i}`} className={cls}>
          {t.text}
        </span>,
      );
      p = t.span.to;
    });
    if (to > p) out.push(<Fragment key={`${keyBase}end`}>{src.slice(p, to)}</Fragment>);
    return out;
  };
  const lines: { from: number; to: number }[] = [];
  for (let from = 0; ; ) {
    const k = src.indexOf('\n', from);
    lines.push({ from, to: k < 0 ? src.length : k });
    if (k < 0) break;
    from = k + 1;
  }
  const lineOf = (pos: number) => lines.findIndex((l) => pos >= l.from && pos <= l.to);
  const headerLine = lineOf(header.from);
  const bodyFirst = stmts.length ? lineOf(stmts[0].span.from) : -1;
  const bodyLast = stmts.length ? lineOf(stmts[stmts.length - 1].span.to) : -2;
  return lines.map((l, i) => {
    let cls = 'code-line';
    let key = `l${i}`;
    let style: React.CSSProperties | undefined;
    if (i === headerLine) {
      cls += ` loop-header${beat.landTick > 0 ? ` check-${beat.landGuard}` : ''}`;
      key += `h${beat.landTick}`;
    } else if (i >= bodyFirst && i <= bodyLast) {
      cls += ` loop-body${beat.hopTick > 0 ? ' running' : ''}${i === bodyFirst ? ' first' : ''}${i === bodyLast ? ' last' : ''}`;
      key += `b${beat.hopTick}`;
      style = { animationDuration: `${Math.max(0.3, beat.hopDur + 0.15)}s` };
    }
    return (
      <div key={key} className={cls} style={style}>
        <span className="code-ln">{i + 1}</span>
        <span className="code-text">{piece(l.from, l.to, `l${i}`)}</span>
      </div>
    );
  });
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const hopTick = useGame((s) => s.hopTick);
  const hopDur = useGame((s) => s.hopDur);
  const landTick = useGame((s) => s.landTick);
  const landGuard = useGame((s) => s.landGuard);
  const selected = useGame((s) => s.selected);
  const reveal = useGame((s) => s.reveal);
  const nodes = useMemo(
    () => highlightSource(level, { hopTick, hopDur, landTick, landGuard }),
    [level, hopTick, hopDur, landTick, landGuard],
  );
  const spot = useGame((s) => s.spotlight);
  if (!reveal.code) return null;
  return (
    <div className={`card code-card ${spot === 'code' ? 'spotlight' : ''}`}>
      <div className="card-label">Program</div>
      <pre className="code">{nodes}</pre>
      <div className={`debugger ${selected ? '' : 'empty'}`}>
        {selected ? (
          <>
            <span className="frog-dot" /> {showState(level, selected)}
          </>
        ) : (
          'Click a frog to see its values'
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar with the three status lights
// ---------------------------------------------------------------------------

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const lights = useGame((s) => s.reveal.lights);
  const verdicts = useGame((s) => s.verdicts);
  const checking = useGame((s) => s.checking);
  const busy = useGame((s) => s.busy);
  const spot = useGame((s) => s.spotlight);
  if (!level) return null;
  return (
    <div className="topbar">
      <div className="pill-group">
        {/* just an arrow: the level's name is what this pill is about */}
        <button
          className="btn ghost icon-btn round-btn"
          title={mode === 'tutorial' ? 'Home' : 'All levels'}
          aria-label={mode === 'tutorial' ? 'Home' : 'All levels'}
          onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}
        >
          <ArrowLeft size={17} strokeWidth={2.4} />
        </button>
        <div className="level-title">
          {mode === 'level' && <span className="level-id">{level.id}</span>}
          {level.title}
        </div>
      </div>
      <div className={`pill-group ${spot === 'lights' ? 'spotlight' : ''}`}>
        {(['init', 'pres', 'exit'] as Rule[])
          .filter((r) => lights.includes(r))
          .map((r) => {
            const v = verdicts[r];
            const status = checking && !v ? 'checking' : (v?.status ?? 'idle');
            return (
              <button
                key={r}
                className={`light ${status}`}
                disabled={busy || v?.status !== 'fail'}
                title={v?.status === 'fail' ? 'Replay the counterexample' : RULE_NAMES[r]}
                onClick={() => v?.status === 'fail' && void director.playCounterexample(v.cex)}
              >
                <LightIcon status={status} />
                {RULE_NAMES[r]}
              </button>
            );
          })}
        <button className="btn ghost icon-btn" onClick={() => useGame.setState({ showRules: true })}>
          <BookOpen size={16} strokeWidth={2.2} /> Rules
        </button>
      </div>
    </div>
  );
}

function LightIcon({ status }: { status: string }) {
  if (status === 'pass') return <CircleCheck size={16} strokeWidth={2.4} />;
  if (status === 'fail') return <CircleX size={16} strokeWidth={2.4} />;
  if (status === 'undecided') return <CircleHelp size={16} strokeWidth={2.4} />;
  if (status === 'checking') return <LoaderCircle size={16} strokeWidth={2.4} className="spin" />;
  return <CircleDashed size={16} strokeWidth={2.2} />;
}

// ---------------------------------------------------------------------------
// What is the pointer on? A readout for the hovered tile.
// ---------------------------------------------------------------------------

/** Room the readout needs to sit in the top bar's row (values plus two tags). */
const READOUT_ROOM = 440;

/**
 * Lift the readout into the top bar's row when the bar's middle is free (the
 * tutorial, wide screens); otherwise it stays just below the bar. The check
 * uses a fixed width, not the current text, so it never hops between rows
 * while you hover around.
 */
function useTopRowPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    const groups = document.querySelectorAll('.topbar > .pill-group');
    if (!groups.length) return;
    const left = groups[0].getBoundingClientRect();
    const right = groups[groups.length - 1].getBoundingClientRect();
    const mid = window.innerWidth / 2;
    const half = READOUT_ROOM / 2;
    const oneRow = Math.abs(left.top - right.top) < 4;
    const fits = mid - half >= left.right && (groups.length < 2 || mid + half <= right.left);
    if (!oneRow || !fits) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translateY(${left.top + left.height / 2 - (r.top + r.height / 2)}px)`;
  });
}

export function HoverReadout() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const tile = useHover((s) => s.tile);
  const ref = useRef<HTMLDivElement>(null);
  useTopRowPlacement(ref);
  if (!tile || !reveal.axes) return null;
  const s = tileState(level, tile[0], tile[1], pond);
  const vals = displayNames(level).filter((n) => n in s).map((n) => `${n} = ${s[n]}`).join(', ');
  // tiles the precondition rules out: there is no such state, so nothing more to say
  if (!level.fast.pondReq(s)) {
    return (
      <div className="readout" ref={ref}>
        <span className="readout-vals">{vals}</span>
        <span className="readout-tag none">not a possible state</span>
      </div>
    );
  }
  const cont = level.fast.guard(s) === true;
  let next: string | null = null;
  if (cont) {
    const n: Record<string, number> = { ...s };
    for (const v in level.fast.next) n[v] = level.fast.next[v](s) as number;
    next = `(${n[level.view.x]}, ${n[level.view.y]})`;
  }
  const inArea = reveal.formula && valid ? valid.fast(s) === true : null;
  const goal = !cont && level.fast.post(s) === true;
  return (
    <div className="readout" ref={ref}>
      <span className="readout-vals">{vals}</span>
      {reveal.stop && (
        <span className={`readout-tag ${cont ? 'go' : 'stop'}`}>{cont ? `hops to ${next}` : goal && reveal.goals ? 'stops · goal ✓' : 'stops here'}</span>
      )}
      {inArea !== null && <span className={`readout-tag ${inArea ? 'area' : 'out'}`}>{inArea ? 'in your area' : 'outside your area'}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Caption bar
// ---------------------------------------------------------------------------

export function CaptionBar() {
  // when the caption goes away, the last one fades out
  const { value: caption, leaving } = useLingering(useGame((s) => s.caption));
  const pitfall = useGame((s) => s.pitfallMessage);
  const back = useGame((s) => (s.mode === 'tutorial' ? s.back : null));
  if (!caption) return null;
  return (
    <div className={`caption ${caption.tone} ${leaving ? 'leaving' : ''}`} key={caption.text}>
      <div className="caption-text">
        <Markdown text={caption.text} />
        {pitfall && caption.tone === 'fail' && !caption.text.includes(pitfall) && (
          <div className="caption-pitfall">
            <Markdown text={pitfall} />
          </div>
        )}
      </div>
      {(caption.secondary || caption.action || back) && (
        <div className="caption-actions">
          {/* tutorial: back to the previous step (left), then the step's own buttons */}
          {back && (
            <button className="btn ghost small icon-btn caption-back" onClick={back}>
              <ArrowLeft size={15} strokeWidth={2.4} /> Back
            </button>
          )}
          <span className="spacer" />
          {caption.secondary && (
            <button className="btn ghost small icon-btn" onClick={caption.secondary.onClick}>
              <RotateCcw size={15} strokeWidth={2.4} />
              {caption.secondary.label}
            </button>
          )}
          {caption.action && (
            <button
              className="btn toy primary small icon-btn caption-main"
              onClick={() => caption.action!.onClick()}
            >
              {caption.action.label === 'Replay' ? <RotateCcw size={15} strokeWidth={2.4} /> : null}
              {caption.action.label}
              {caption.action.label !== 'Replay' ? <ArrowRight size={15} strokeWidth={2.4} /> : null}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run controls
// ---------------------------------------------------------------------------

export function RunControls() {
  const reveal = useGame((s) => s.reveal);
  const runningNow = useGame((s) => s.running);
  const busy = useGame((s) => s.busy);
  const stepping = useGame((s) => s.stepping);
  const mode = useGame((s) => s.mode);
  const suggestion = useGame((s) => s.suggestion);
  const spot = useGame((s) => s.spotlight);
  const allow = useGame((s) => s.tutorialAllow);
  const tut = mode === 'tutorial';
  return (
    <div className="run-controls">
      {reveal.run &&
        (runningNow ? (
          <button className="btn icon-btn" onClick={() => director.pause()}>
            <Pause size={16} strokeWidth={2.4} /> Pause
          </button>
        ) : (
          <button
            className={`btn icon-btn ${spot === 'run' ? 'spotlight' : ''}`}
            disabled={busy || stepping || (tut && !allow.run)}
            onClick={() => void director.run()}
          >
            <Play size={16} strokeWidth={2.4} /> Run
          </button>
        ))}
      {reveal.step && (
        <button
          className={`btn icon-btn ${spot === 'step' ? 'spotlight' : ''}`}
          disabled={busy || runningNow || stepping || (tut && !allow.step)}
          onClick={() => void director.step()}
        >
          <StepForward size={16} strokeWidth={2.4} /> Step
        </button>
      )}
      {reveal.run && !tut && (
        <button className="btn ghost icon-btn" disabled={busy} title="Put every frog back in its egg (your area stays)" onClick={() => director.clearFrogs()}>
          <RotateCcw size={16} strokeWidth={2.2} /> Reset
        </button>
      )}
      <span className="spacer" />
      {tut && suggestion && reveal.formula && (
        <button className="btn ghost icon-btn" onClick={() => useGame.getState().setFormula(suggestion)}>
          <Wand2 size={16} strokeWidth={2.2} /> Show me
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pond gauge: an elevator panel. Each input value is a floor of the stack.
// ---------------------------------------------------------------------------

export function PondGauge() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const busy = useGame((s) => s.busy);
  const elevating = useGame((s) => s.elevating);
  const ponds = level.ponds;
  const exists = (p: number) =>
    !!ponds && p >= ponds.min && p <= ponds.max && level.fast.pondReq({ [level.pond!]: p, [level.view.x]: 0, [level.view.y]: 0 }) === true;
  const step = (d: number) => {
    let p = pond + d;
    while (ponds && p >= ponds.min && p <= ponds.max && !exists(p)) p += d;
    if (exists(p)) useGame.getState().setPond(p);
  };
  useEffect(() => {
    if (!level.pond) return;
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().busy) return;
      if (e.key === 'PageUp' || (e.key === ']' && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor')))) {
        e.preventDefault();
        step(1);
      }
      if (e.key === 'PageDown' || (e.key === '[' && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor')))) {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!level.pond || !ponds) return null;
  const floors = [pond + 2, pond + 1, pond, pond - 1, pond - 2];
  return (
    <div className={`card gauge ${elevating ? 'moving' : ''}`}>
      <div className="card-label">Input</div>
      <button className="gauge-arrow" disabled={busy || !exists(pond + 1)} onClick={() => step(1)} title="Next input (PageUp or ])">
        <ChevronUp size={18} strokeWidth={2.6} />
      </button>
      <div className="gauge-floors">
        {floors.map((p) => (
          <button
            key={p}
            className={`gauge-floor ${p === pond ? 'current' : ''}`}
            disabled={busy || !exists(p)}
            onClick={() => exists(p) && useGame.getState().setPond(p)}
          >
            {exists(p) ? (
              <>
                <span className="gauge-name">{level.pond}</span> = {p}
              </>
            ) : (
              '—'
            )}
          </button>
        ))}
      </div>
      <button className="gauge-arrow" disabled={busy || !exists(pond - 1)} onClick={() => step(-1)} title="Previous input (PageDown or [)">
        <ChevronDown size={18} strokeWidth={2.6} />
      </button>
      <div className="gauge-hint">each input is its own pond</div>
    </div>
  );
}

/** Shown while the camera rides between ponds. */
export function ElevatorToast() {
  const level = useGame((s) => s.level);
  const pond = useGame((s) => s.pond);
  const elevating = useGame((s) => s.elevating);
  const dir = useGame((s) => s.elevatorDir);
  const { mounted, leaving } = usePresence(!!level?.pond && elevating);
  if (!level?.pond || !mounted) return null;
  return (
    <div className={`elevator-toast ${leaving ? 'leaving' : ''}`} key={pond}>
      <span className="elevator-arrow">{dir > 0 ? <ArrowUp size={22} strokeWidth={2.8} /> : <ArrowDown size={22} strokeWidth={2.8} />}</span>
      <span className="elevator-name">{level.pond}</span> = {pond}
    </div>
  );
}

