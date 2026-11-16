import { Dices, Minus, Plus } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { MAX_LEN, planeExists, planeKey, rollArray, withLengths, type Inputs } from '../../levels/inputs';
import type { CompiledLevel } from '../../levels/level';
import { CARD_LABEL, FOLD } from '../classes';
import { TOKEN } from '../codeColors';

const showArray = (a: number[]) => `[${a.join(', ')}]`;

const incomplete = (text: string) => /^\[?$/.test(text.trim());

function parseArray(text: string): number[] | null {
  if (incomplete(text)) return null;
  const inner = text.trim().replace(/^\[/, '').replace(/\]$/, '');
  const parts = inner.split(/[\s,]+/).filter((p) => p !== '');
  if (parts.some((p) => !/^-?\d{1,6}$/.test(p)) || parts.length > MAX_LEN) return null;
  return parts.map(Number);
}

const INT = /^-?\d{1,9}$/;

const FIELD =
  'h-6 min-w-0 rounded-md border border-line bg-white px-1.5 font-mono text-sm text-ink outline-none transition-colors focus:border-brand/60 disabled:opacity-60';
const SMALL_BUTTON =
  'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-sky text-muted transition-colors enabled:hover:bg-horizon enabled:hover:text-ink enabled:active:translate-y-px disabled:cursor-default';

export function inputRows(level: CompiledLevel): string[] {
  const lengths = new Set(Object.values(level.arrays));
  return level.offAxis.filter((n) => !lengths.has(n));
}

export function InputsSection({ folded }: { folded: boolean }) {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const busy = useGame((s) => s.busy);
  const cued = useGame((s) => s.cuedInputs);
  const tr = useT();
  const rows = inputRows(level);
  const exists = planeExists(level, inputs);
  if (rows.length === 0) return null;
  const set = (next: Inputs) => {
    if (useGame.getState().busy) return;
    useGame.setState({ inputs: next });
  };
  const hasArrays = Object.keys(level.arrays).length > 0;
  return (
    <div
      className={`-mx-4 flex min-w-0 shrink-0 flex-col border-t px-4 transition-[opacity,border-color,padding] ${FOLD} max-md:-mx-2.5 max-md:px-2.5 ${
        folded ? 'border-transparent pt-1' : 'border-line pt-2.5 max-md:pt-2'
      }`}
    >
      <div
        className={`grid transition-[grid-template-rows,opacity] ${FOLD} ${folded ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]'}`}
        aria-hidden={folded}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={CARD_LABEL}>{tr.inputs.title}</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((name) => (
          <div
            key={name}
            className={`-mx-1.5 flex items-center gap-2 rounded-lg px-1.5 ${cued.includes(name) ? 'spotlight spotlight-soft' : ''}`}
            onPointerEnter={() => useGame.setState({ inputHover: name })}
            onPointerLeave={() => useGame.setState((s) => (s.inputHover === name ? { inputHover: null } : {}))}
          >
            <span className={`w-5 shrink-0 font-mono text-sm font-semibold ${TOKEN.name}`}>{name}</span>
            {level.arrays[name] ? (
              <ArrayRow level={level} name={name} inputs={inputs} disabled={busy} onChange={set} label={tr.inputs.random(name)} />
            ) : (
              <IntRow
                name={name}
                value={inputs[name] as number}
                disabled={busy}
                onChange={(v) => set({ ...inputs, [name]: v })}
                labels={[tr.inputs.decrease(name), tr.inputs.increase(name)]}
              />
            )}
          </div>
        ))}
      </div>
      {(hasArrays || !exists) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-xs text-faint">
          {Object.entries(level.arrays).map(([a, len]) => (
            <span key={a}>
              {len} = {(inputs[a] as number[]).length}
            </span>
          ))}
          {!exists && <span className="animate-fade font-sans text-warn">{tr.inputs.impossible}</span>}
        </div>
      )}
    </div>
  );
}

const changed = (pops: number) => (pops > 0 ? 'animate-input-changed' : 'animate-pop');

function usePop(value: string): [number, () => void] {
  const [seen, setSeen] = useState(value);
  const [ownNext, setOwnNext] = useState(false);
  const [pops, setPops] = useState(0);
  if (value !== seen) {
    setSeen(value);
    if (ownNext) setOwnNext(false);
    else setPops(pops + 1);
  }
  return [pops, () => setOwnNext(true)];
}

function useDraft(shown: string) {
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const draft = editing ? text : null;
  const field = {
    value: draft ?? shown,
    onFocus: () => {
      setText(shown);
      setEditing(true);
    },
    onBlur: () => setEditing(false),
  };
  return { draft, setDraft: setText, field };
}

function IntRow({ name, value, disabled, onChange, labels }: { name: string; value: number; disabled: boolean; onChange: (v: number) => void; labels: [string, string] }) {
  const { draft, setDraft, field } = useDraft(String(value));
  const [pops, own] = usePop(String(value));
  const commit = (v: number) => {
    own();
    onChange(v);
  };
  const type = (t: string) => {
    setDraft(t);
    if (INT.test(t.trim())) commit(Number(t.trim()));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const d = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    commit(value + d);
  };
  const bad = draft !== null && !INT.test(draft.trim());
  return (
    <div key={pops} className={`flex items-center rounded-md ${changed(pops)}`}>
      <SmallButton onClick={() => commit(value - 1)} disabled={disabled} label={labels[0]} className="rounded-r-none">
        <Minus size={12} strokeWidth={2.6} />
      </SmallButton>
      <input
        className={`${FIELD} w-10 rounded-none border-x-0 text-center ${bad ? 'text-fail' : ''}`}
        {...field}
        inputMode="numeric"
        disabled={disabled}
        aria-label={name}
        onChange={(e) => type(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <SmallButton onClick={() => commit(value + 1)} disabled={disabled} label={labels[1]} className="rounded-l-none">
        <Plus size={12} strokeWidth={2.6} />
      </SmallButton>
    </div>
  );
}

function SmallButton({ onClick, disabled, label, className = '', children }: { onClick: () => void; disabled: boolean; label: string; className?: string; children: ReactNode }) {
  return (
    <button className={`${SMALL_BUTTON} ${className}`} disabled={disabled} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function ArrayRow({ level, name, inputs, disabled, onChange, label }: { level: CompiledLevel; name: string; inputs: Inputs; disabled: boolean; onChange: (next: Inputs) => void; label: string }) {
  const value = inputs[name] as number[];
  const { draft, setDraft, field } = useDraft(showArray(value));
  const [pops, own] = usePop(planeKey({ [name]: value }));
  const type = (t: string) => {
    setDraft(t);
    const arr = parseArray(t);
    if (arr) {
      own();
      onChange(withLengths(level, { ...inputs, [name]: arr }));
    }
  };
  const bad = draft !== null && !incomplete(draft) && parseArray(draft) === null;
  return (
    <div key={pops} className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md ${changed(pops)}`}>
      <input
        className={`${FIELD} flex-1 ${bad ? 'border-fail/50 text-fail' : ''}`}
        {...field}
        disabled={disabled}
        aria-label={name}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => type(e.target.value)}
      />
      <SmallButton
        onClick={() => {
          own();
          onChange(rollArray(level, inputs, name));
        }}
        disabled={disabled}
        label={label}
      >
        <Dices size={13} strokeWidth={2.2} />
      </SmallButton>
    </div>
  );
}
