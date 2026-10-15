import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder, type DecorationSet } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { check } from '../../game/actions';
import { useGame } from '../../game/store';
import { displayNames } from '../../levels/level';
import { button } from '../classes';

// The area formula: a one-line CodeMirror editor with highlighting, errors
// once typing pauses, and Check.

const exprLanguage = StreamLanguage.define<null>({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^[0-9]+/)) return 'number';
    if (stream.match(/^(abs|min|max)\b/)) return 'keyword';
    if (stream.match(/^(true|false)\b/)) return 'atom';
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) return 'variableName';
    if (stream.match(/^(==|!=|<=|>=|&&|\|\||[-+*/%<>!])/)) return 'operator';
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.number, color: '#b45f06' },
  { tag: tags.keyword, color: '#7a4fd0' },
  { tag: tags.atom, color: '#7a4fd0' },
  { tag: tags.variableName, color: '#1f5fae', fontWeight: '600' },
  { tag: tags.operator, color: '#5b6472' },
]);

const setError = StateEffect.define<{ from: number; to: number } | null>();
const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setError)) {
        if (!e.value) deco = Decoration.none;
        else {
          const len = tr.state.doc.length;
          const from = Math.min(e.value.from, len);
          const to = Math.min(Math.max(e.value.to, from + 1), len);
          deco = from < to ? Decoration.set([Decoration.mark({ class: 'underline decoration-fail decoration-wavy underline-offset-4' }).range(from, to)]) : Decoration.none;
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const singleLine = EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr));

/** In the tutorial the area can only be edited while a step allows it. */
const isLocked = (g: { mode: string; tutorialAllow: { formula: boolean } }) => g.mode === 'tutorial' && !g.tutorialAllow.formula;
const lockExt = (locked: boolean): Extension => [EditorState.readOnly.of(locked), EditorView.editable.of(!locked)];
/** The placeholder: what a condition may mention. */
function placeholderExt(names: string[]): Extension {
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
  return placeholder(`a condition on ${list}`);
}

export function FormulaBox() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const placeholderComp = useRef(new Compartment());
  const lockComp = useRef(new Compartment());
  const level = useGame((s) => s.level);
  // a fresh array would re-render forever: memoised on the level
  const names = useMemo(() => (level ? displayNames(level) : []), [level]);
  const formula = useGame((s) => s.formula);
  const formulaText = useGame((s) => s.formulaText);
  const levelId = useGame((s) => s.level?.id);
  const busy = useGame((s) => s.busy);
  const checking = useGame((s) => s.checking);
  const mode = useGame((s) => s.mode);
  const awaitingCheck = useGame((s) => s.awaitingCheck);
  const allowFormula = useGame((s) => s.tutorialAllow.formula);
  const locked = isLocked({ mode, tutorialAllow: { formula: allowFormula } });
  const spot = useGame((s) => s.spotlight);
  // errors appear only once typing pauses, so half-typed input doesn't flash errors
  const [settledError, setSettledError] = useState<{ message: string; span: { from: number; to: number } } | null>(null);
  const errorNudge = useGame((s) => s.errorNudge);
  const [shake, setShake] = useState(false);
  // most checks finish almost instantly; only swap in a spinner if one takes a while
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!checking) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 450);
    return () => clearTimeout(t);
  }, [checking]);
  useEffect(() => {
    const err = formula && !formula.ok ? { message: formula.error.message, span: formula.error.span } : null;
    if (!err) {
      setSettledError(null);
      return;
    }
    const t = setTimeout(() => setSettledError(err), 800);
    return () => clearTimeout(t);
  }, [formula]);
  // Check pressed with an invalid formula: show its error right away, with a nudge
  useEffect(() => {
    if (!errorNudge) return;
    const f = useGame.getState().formula;
    if (f && !f.ok) setSettledError({ message: f.error.message, span: f.error.span });
    setShake(true);
    const t = setTimeout(() => setShake(false), 340);
    return () => clearTimeout(t);
  }, [errorNudge]);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: useGame.getState().formulaText,
        extensions: [
          history(),
          singleLine,
          // a formula too long for the box (or a placeholder, on phones) wraps rather than scrolling out of sight
          EditorView.lineWrapping,
          errorField,
          exprLanguage,
          syntaxHighlighting(highlight),
          placeholderComp.current.of(placeholderExt(useGame.getState().level ? displayNames(useGame.getState().level!) : [])),
          lockComp.current.of(lockExt(isLocked(useGame.getState()))),
          keymap.of([
            { key: 'Enter', run: () => (void check(), true) },
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) useGame.getState().setFormula(u.state.doc.toString());
          }),
          EditorView.theme({
            '&': { fontSize: 'var(--formula-size)' },
            '.cm-content': { fontFamily: 'var(--mono)', padding: '10px 4px' },
            '&.cm-focused': { outline: 'none' },
            '.cm-placeholder': { color: '#a8afbb' },
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: lockComp.current.reconfigure(lockExt(locked)) });
  }, [locked]);

  useEffect(() => {
    view.current?.dispatch({ effects: placeholderComp.current.reconfigure(placeholderExt(names)) });
  }, [names]);

  // external text changes (level switch, "show me")
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (v.state.doc.toString() !== formulaText) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: formulaText } });
    }
  }, [formulaText, levelId]);

  // error underline (also only once typing pauses)
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ effects: setError.of(settledError ? settledError.span : null) });
  }, [settledError]);

  const canCheck = !busy && !checking && (mode !== 'tutorial' || awaitingCheck);
  return (
    // 16px on phones: any smaller and iOS zooms the page when the box is focused
    <div className="animate-[rise_0.4s_ease-out] [--formula-size:17px] max-sm:[--formula-size:16px]">
      <div
        className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white py-1.25 pr-1.5 pl-4 shadow-card max-sm:flex-wrap max-sm:gap-x-2 max-sm:pl-3 transition-colors duration-150 ${settledError ? 'border-fail/50' : 'border-brand/30 focus-within:border-brand/65'} ${spot === 'formula' ? 'spotlight' : ''} ${shake ? 'animate-shake' : ''}`}
      >
        {/* a little slab, like the area's in the scene */}
        {/* the slab sits a touch high: the capitals' optical centre is above the line box's */}
        {/* on phones only the slab, so the formula gets the room */}
        <span className="flex items-center gap-1.75 font-display text-xs font-semibold tracking-[0.08em] text-brand uppercase before:size-3 before:-translate-y-px before:rounded-sm before:bg-slab before:shadow-[0_2px_0_var(--color-slab-side)]">
          <span className="max-sm:sr-only">area</span>
        </span>
        {/* read-only (faded) while the tutorial isn't asking for a formula */}
        <div className={`min-w-0 flex-1 ${locked ? 'cursor-default opacity-60' : ''}`} ref={host} />
        {/* inside the box: never covers the caption, never changes the layout (on phones, a row of its own under the formula) */}
        {settledError && (
          <span
            className="max-w-[46%] flex-[0_1_auto] animate-fade truncate rounded-lg bg-[#fff1f0] px-2.5 py-1 text-xs text-[#b42318] max-sm:order-last max-sm:mb-1 max-sm:max-w-full max-sm:basis-full"
            title={settledError.message}
          >
            {settledError.message}
          </span>
        )}
        <button
          className={`${button('check', 'none')} ${spot === 'check' ? 'spotlight spotlight-glow' : ''}`}
          disabled={!canCheck}
          onClick={() => void check()}
        >
          {slow ? <LoaderCircle size={16} strokeWidth={2.6} className="animate-spin" /> : <Check size={16} strokeWidth={2.8} />}
          Check
        </button>
      </div>
    </div>
  );
}
