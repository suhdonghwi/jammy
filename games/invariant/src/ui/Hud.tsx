import { Fragment, useEffect, useMemo } from 'react';
import { RULE_NAMES, showState, type CompiledLevel, type Rule } from '../levels/level';
import { useGame } from '../store/game';
import { director } from '../director/director';
import { goMenu, showHint } from '../director/play';
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
  Eraser,
  Lightbulb,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  Wand2,
} from 'lucide-react';
import { tileState } from '../scene/tiles';

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
 * Syntax-highlighted program. While frogs hop, the loop body lights up (that is
 * what a hop runs); when they land, the condition flashes green (keep looping)
 * or amber (stop).
 */
function highlightSource(level: CompiledLevel, beat: Beat) {
  const src = level.program.source;
  const header = level.program.loop.headerSpan;
  const stmts = level.program.loop.body;
  const lineStart = (i: number) => src.lastIndexOf('\n', i - 1) + 1;
  const lineEnd = (i: number) => {
    const k = src.indexOf('\n', i);
    return k < 0 ? src.length : k;
  };
  const body = stmts.length
    ? { from: lineStart(stmts[0].span.from), to: lineEnd(stmts[stmts.length - 1].span.to) }
    : { from: header.to, to: header.to };
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
  return [
    ...piece(0, header.from, 'a'),
    <span key={`hdr${beat.landTick}`} className={`loop-header ${beat.landTick > 0 ? `check-${beat.landGuard}` : ''}`}>
      {piece(header.from, header.to, 'h')}
    </span>,
    ...piece(header.to, body.from, 'm'),
    <span
      key={`body${beat.hopTick}`}
      className={`loop-body ${beat.hopTick > 0 ? 'running' : ''}`}
      style={{ animationDuration: `${Math.max(0.3, beat.hopDur + 0.15)}s` }}
    >
      {piece(body.from, body.to, 'b')}
    </span>,
    ...piece(body.to, src.length, 'c'),
  ];
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
        <button className="btn ghost icon-btn" onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}>
          <ArrowLeft size={16} strokeWidth={2.4} /> {mode === 'tutorial' ? 'Home' : 'Levels'}
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

export function HoverReadout() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const tile = useHover((s) => s.tile);
  if (!tile || !reveal.axes) return null;
  const s = tileState(level, tile[0], tile[1], pond);
  // tiles outside the precondition's inputs don't exist — nothing to inspect
  if (!level.fast.pondReq(s)) return null;
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
    <div className="readout">
      <span className="readout-vals">{level.names.map((n) => `${n} = ${s[n]}`).join(', ')}</span>
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

function renderInlineCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function CaptionBar() {
  const caption = useGame((s) => s.caption);
  const pitfall = useGame((s) => s.pitfallMessage);
  if (!caption) return null;
  return (
    <div className={`caption ${caption.tone}`} key={caption.text}>
      <div className="caption-text">
        {renderInlineCode(caption.text)}
        {pitfall && caption.tone === 'fail' && !caption.text.includes(pitfall) && (
          <div className="caption-pitfall">{renderInlineCode(pitfall)}</div>
        )}
      </div>
      {caption.action && (
        <button className="btn toy primary small icon-btn" onClick={caption.action.onClick}>
          {caption.action.label === 'Replay' ? <RotateCcw size={15} strokeWidth={2.4} /> : null}
          {caption.action.label}
          {caption.action.label !== 'Replay' ? <ArrowRight size={15} strokeWidth={2.4} /> : null}
        </button>
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
  const hints = useGame((s) => s.hints);
  const showMe = useGame((s) => s.showMe);
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
        <button className="btn ghost icon-btn" disabled={busy} onClick={() => director.clearFrogs()}>
          <Eraser size={16} strokeWidth={2.2} /> Clear
        </button>
      )}
      <span className="spacer" />
      {reveal.formula && hints.length > 0 && (
        <button className="btn ghost icon-btn" onClick={showHint}>
          <Lightbulb size={16} strokeWidth={2.2} /> Hint
        </button>
      )}
      {mode === 'tutorial' && showMe && reveal.formula && (
        <button className="btn ghost icon-btn" onClick={() => useGame.getState().setFormula(showMe)}>
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
  if (!level?.pond || !elevating) return null;
  return (
    <div className="elevator-toast" key={pond}>
      <span className="elevator-arrow">{dir > 0 ? <ArrowUp size={22} strokeWidth={2.8} /> : <ArrowDown size={22} strokeWidth={2.8} />}</span>
      <span className="elevator-name">{level.pond}</span> = {pond}
    </div>
  );
}

