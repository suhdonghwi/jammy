import { Fragment, useMemo } from 'react';
import { showState, RULE_NAMES, type Rule } from '../levels/level';
import { useGame } from '../store/game';
import { director } from '../director/director';
import { goMenu, showHint } from '../director/play';
import { tokenize } from '../lang/parser';

// ---------------------------------------------------------------------------
// Code panel: the program, with the loop header lighting up on each landing
// and the selected frog's values shown like a debugger.
// ---------------------------------------------------------------------------

const KW = new Set(['input', 'var', 'requires', 'ensures', 'while', 'if', 'else', 'true', 'false', 'abs', 'min', 'max']);

function highlightSource(src: string, header: { from: number; to: number }, landings: number) {
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
    <span key={`hdr${landings}`} className={`loop-header ${landings > 0 ? 'pulse' : ''}`}>
      {piece(header.from, header.to, 'h')}
    </span>,
    ...piece(header.to, src.length, 'b'),
  ];
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const landings = useGame((s) => s.landings);
  const selected = useGame((s) => s.selected);
  const reveal = useGame((s) => s.reveal);
  const nodes = useMemo(
    () => highlightSource(level.program.source, level.program.loop.headerSpan, landings),
    [level, landings],
  );
  if (!reveal.code) return null;
  return (
    <div className="panel code-panel">
      <pre className="code">{nodes}</pre>
      <div className={`debugger ${selected ? '' : 'empty'}`}>
        {selected ? showState(level, selected) : 'click a frog to see its values'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar with the three status lights
// ---------------------------------------------------------------------------

export function TopBar() {
  const level = useGame((s) => s.level)!;
  const mode = useGame((s) => s.mode);
  const lights = useGame((s) => s.reveal.lights);
  const verdicts = useGame((s) => s.verdicts);
  const checking = useGame((s) => s.checking);
  const busy = useGame((s) => s.busy);
  const cleared = useGame((s) => s.cleared);
  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="btn ghost" onClick={goMenu} title="Back to levels">
          ← Levels
        </button>
        <div className="level-title">
          {mode === 'level' && <span className="level-id">{level.id}</span>}
          {level.title}
          {cleared && mode === 'level' && <span className="cleared-badge">✓ proved</span>}
        </div>
      </div>
      <div className="topbar-right">
        <div className="lights">
          {(['init', 'pres', 'exit'] as Rule[])
            .filter((r) => lights.includes(r))
            .map((r) => {
              const v = verdicts[r];
              const status = checking ? 'checking' : v?.status ?? 'idle';
              return (
                <button
                  key={r}
                  className={`light ${status}`}
                  disabled={busy || v?.status !== 'fail'}
                  title={v?.status === 'fail' ? 'Replay the counterexample' : RULE_NAMES[r]}
                  onClick={() => v?.status === 'fail' && void director.playCounterexample(v.cex)}
                >
                  <span className="dot" />
                  {RULE_NAMES[r]}
                </button>
              );
            })}
        </div>
        <button className="btn ghost" onClick={() => useGame.setState({ showRules: true })}>
          Rules
        </button>
      </div>
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
        <button className="btn primary small" onClick={caption.action.onClick}>
          {caption.action.label}
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
  const mode = useGame((s) => s.mode);
  const hints = useGame((s) => s.hints);
  const showMe = useGame((s) => s.showMe);
  return (
    <div className="run-controls">
      {reveal.run &&
        (runningNow ? (
          <button className="btn" onClick={() => director.pause()}>
            ⏸ Pause
          </button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => void director.run()}>
            ▶ Run
          </button>
        ))}
      {reveal.step && (
        <button className="btn" disabled={busy || runningNow} onClick={() => void director.step()}>
          ⏭ Step
        </button>
      )}
      {reveal.run && (
        <button className="btn ghost" disabled={busy} onClick={() => director.clearFrogs()}>
          Clear frogs
        </button>
      )}
      <span className="spacer" />
      {reveal.formula && hints.length > 0 && (
        <button className="btn ghost" onClick={showHint}>
          Hint
        </button>
      )}
      {mode === 'tutorial' && showMe && reveal.formula && (
        <button className="btn ghost" onClick={() => useGame.getState().setFormula(showMe)}>
          Show me
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pond slider (vertical, because ponds are stacked vertically)
// ---------------------------------------------------------------------------

export function PondSlider() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const busy = useGame((s) => s.busy);
  if (!level.pond || !level.ponds) return null;
  const { min, max } = level.ponds;
  const exists = (p: number) => level.fast.pondReq({ [level.pond!]: p, [level.view.x]: 0, [level.view.y]: 0 }) === true;
  const move = (d: number) => {
    let p = pond + d;
    while (p >= min && p <= max && !exists(p)) p += d;
    if (p >= min && p <= max) useGame.getState().setPond(p);
  };
  return (
    <div className="pond-slider panel">
      <div className="pond-name">{level.pond}</div>
      <button className="btn ghost small" disabled={busy || pond >= max} onClick={() => move(1)}>
        ▲
      </button>
      <input
        type="range"
        min={min}
        max={max}
        value={pond}
        disabled={busy}
        onChange={(e) => {
          const p = Number(e.target.value);
          if (exists(p)) useGame.getState().setPond(p);
        }}
        className="vertical-range"
      />
      <button className="btn ghost small" disabled={busy || pond <= min} onClick={() => move(-1)}>
        ▼
      </button>
      <div className="pond-value">{pond}</div>
    </div>
  );
}
