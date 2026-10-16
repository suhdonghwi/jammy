import { Dices, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { MAX_LEN, planeExists, planeKey, rollArray, withLengths, type CompiledLevel, type Inputs } from '../../levels/level';
import { CARD_LABEL } from '../classes';

// The inputs that are not on an axis, at the foot of the code card, one row
// each: a number with − and + for an integer, a text field (and a dice) for an array. Changing one picks
// another plane of the state space, and the scene swaps to it at once. A
// value the precondition rules out is allowed: the plane is then all ghost
// tiles, and the code panel's `requires` line says why.

/** An array as the field shows it. */
const showArray = (a: number[]) => `[${a.join(', ')}]`;

/** A field with nothing typed yet (or only the opening bracket): the plane stays as it was, with no error shown. */
const incomplete = (text: string) => /^\[?$/.test(text.trim());

/** The integers typed into an array field: `1, 3 4` or `[1,3,4]`; null when it isn't a list of at most MAX_LEN integers. */
function parseArray(text: string): number[] | null {
  if (incomplete(text)) return null;
  const inner = text.trim().replace(/^\[/, '').replace(/\]$/, '');
  const parts = inner.split(/[\s,]+/).filter((p) => p !== '');
  if (parts.some((p) => !/^-?\d{1,6}$/.test(p)) || parts.length > MAX_LEN) return null;
  return parts.map(Number);
}

const INT = /^-?\d{1,9}$/;

// as tall as the small buttons beside it, so a stepper's three parts line up
const FIELD =
  'h-7 min-w-0 rounded-md border border-line bg-white px-1.5 font-mono text-sm text-ink outline-none transition-colors focus:border-brand/60 disabled:opacity-60';
const SMALL_BUTTON =
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-sky text-muted transition-colors enabled:hover:bg-horizon enabled:hover:text-ink enabled:active:translate-y-px disabled:cursor-default';

/** The inputs that get a row: those not on an axis, less arrays' lengths (a length follows its array). */
export function inputRows(level: CompiledLevel): string[] {
  const lengths = new Set(Object.values(level.arrays));
  return level.offAxis.filter((n) => !lengths.has(n));
}

/**
 * The inputs, as the code card's last part. Under the code they get a label
 * and a rule across the card; with the code folded they sit beside its title,
 * so the folded card is one row (an array takes a second).
 */
export function InputsSection({ inline }: { inline: boolean }) {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const busy = useGame((s) => s.busy);
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
      className={`flex min-w-0 flex-col transition-opacity ${busy ? 'opacity-60' : ''} ${
        // an array's field needs the room: folded, it goes under the title rather than beside it
        inline ? (hasArrays ? 'basis-full' : 'min-w-36 flex-1') : '-mx-4 shrink-0 border-t border-line px-4 pt-2.5 max-md:-mx-2.5 max-md:px-2.5 max-md:pt-2'
      }`}
    >
      {!inline && <div className={CARD_LABEL}>{tr.inputs.title}</div>}
      <div className="flex flex-col gap-1.5">
        {rows.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2"
            onPointerEnter={() => useGame.setState({ inputHover: name })}
            onPointerLeave={() => useGame.setState((s) => (s.inputHover === name ? { inputHover: null } : {}))}
          >
            <span className="w-5 shrink-0 font-mono text-sm font-semibold text-[#1f63c4]">{name}</span>
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
      {/* under the rows: each array's length, and whether such an input exists at all */}
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

/** A change made elsewhere (a check moving the view to a counterexample's plane) makes the field pop. */
function usePop(value: string, own: RefObject<boolean>): number {
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (own.current) own.current = false;
    else setPops((k) => k + 1);
  }, [value, own]);
  return pops;
}

function IntRow({ name, value, disabled, onChange, labels }: { name: string; value: number; disabled: boolean; onChange: (v: number) => void; labels: [string, string] }) {
  const own = useRef(false);
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const pops = usePop(String(value), own);
  // the field follows the value unless it is being typed in
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);
  const commit = (v: number) => {
    own.current = true;
    onChange(v);
  };
  const type = (t: string) => {
    setText(t);
    if (INT.test(t.trim())) commit(Number(t.trim()));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const d = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    commit(value + d);
  };
  const bad = editing && !INT.test(text.trim());
  return (
    <div key={pops} className="flex animate-[pop_0.3s_ease-out] items-center">
      <SmallButton onClick={() => commit(value - 1)} disabled={disabled} label={labels[0]} className="rounded-r-none">
        <Minus size={14} strokeWidth={2.6} />
      </SmallButton>
      <input
        className={`${FIELD} w-13 rounded-none border-x-0 text-center ${bad ? 'text-fail' : ''}`}
        value={text}
        inputMode="numeric"
        disabled={disabled}
        aria-label={name}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          setText(String(value));
        }}
        onChange={(e) => type(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <SmallButton onClick={() => commit(value + 1)} disabled={disabled} label={labels[1]} className="rounded-l-none">
        <Plus size={14} strokeWidth={2.6} />
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
  const own = useRef(false);
  const value = inputs[name] as number[];
  const shown = showArray(value);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  const pops = usePop(planeKey({ [name]: value }), own);
  useEffect(() => {
    if (!editing) setText(shown);
  }, [shown, editing]);
  const type = (t: string) => {
    setText(t);
    const arr = parseArray(t);
    if (arr) {
      own.current = true;
      onChange(withLengths(level, { ...inputs, [name]: arr }));
    }
  };
  const bad = editing && !incomplete(text) && parseArray(text) === null;
  return (
    <div key={pops} className="flex min-w-0 flex-1 animate-[pop_0.3s_ease-out] items-center gap-1.5">
      <input
        className={`${FIELD} flex-1 ${bad ? 'border-fail/50 text-fail' : ''}`}
        value={text}
        disabled={disabled}
        aria-label={name}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          setText(shown);
        }}
        onChange={(e) => type(e.target.value)}
      />
      <SmallButton
        onClick={() => {
          own.current = true;
          onChange(rollArray(level, inputs, name));
        }}
        disabled={disabled}
        label={label}
      >
        <Dices size={15} strokeWidth={2.2} />
      </SmallButton>
    </div>
  );
}
