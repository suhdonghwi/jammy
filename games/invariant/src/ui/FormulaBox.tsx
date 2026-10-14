import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder, type DecorationSet } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import { useGame } from '../store/game';
import { check } from '../director/play';

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
          deco = from < to ? Decoration.set([Decoration.mark({ class: 'cm-error-mark' }).range(from, to)]) : Decoration.none;
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const singleLine = EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr));

export function FormulaBox() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const ghostComp = useRef(new Compartment());
  const ghost = useGame((s) => s.ghost);
  const formula = useGame((s) => s.formula);
  const formulaText = useGame((s) => s.formulaText);
  const levelId = useGame((s) => s.level?.id);
  const busy = useGame((s) => s.busy);
  const checking = useGame((s) => s.checking);

  useEffect(() => {
    const ghostExt = (g: string | null): Extension => placeholder(g ? `${g}   ⇥ Tab` : 'type a condition, e.g. x >= 0');
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: useGame.getState().formulaText,
        extensions: [
          history(),
          singleLine,
          errorField,
          exprLanguage,
          syntaxHighlighting(highlight),
          ghostComp.current.of(ghostExt(useGame.getState().ghost)),
          keymap.of([
            { key: 'Enter', run: () => (void check(), true) },
            {
              key: 'Tab',
              run: (view) => {
                const g = useGame.getState().ghost;
                if (view.state.doc.length === 0 && g) {
                  view.dispatch({ changes: { from: 0, insert: g }, selection: { anchor: g.length } });
                  return true;
                }
                return false;
              },
            },
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) useGame.getState().setFormula(u.state.doc.toString());
          }),
          EditorView.theme({
            '&': { fontSize: '17px' },
            '.cm-content': { fontFamily: 'var(--mono)', padding: '10px 4px' },
            '&.cm-focused': { outline: 'none' },
            '.cm-placeholder': { color: '#a8afbb' },
          }),
        ],
      }),
    });
    view.current = v;
    (window as unknown as { __formulaView?: EditorView }).__formulaView = v;
    return () => v.destroy();
  }, []);

  // ghost text changes
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({
      effects: ghostComp.current.reconfigure(placeholder(ghost ? `${ghost}   ⇥ Tab` : 'type a condition, e.g. x >= 0')),
    });
  }, [ghost]);

  // external text changes (level switch, "show me")
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (v.state.doc.toString() !== formulaText) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: formulaText } });
    }
  }, [formulaText, levelId]);

  // error underline
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ effects: setError.of(formula && !formula.ok ? formula.error.span : null) });
  }, [formula]);

  const error = formula && !formula.ok ? formula.error.message : null;
  return (
    <div className="formula">
      <div className={`formula-row ${error ? 'has-error' : ''}`}>
        <span className="formula-label">area</span>
        <div className="formula-editor" ref={host} />
        <button className="btn primary" disabled={busy || checking} onClick={() => void check()}>
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>
      {error && <div className="formula-error">{error}</div>}
    </div>
  );
}
