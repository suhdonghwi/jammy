import { useEffect, useState } from 'react';
import { hasOwnClip, loadClip, overrideRole, previewRole, type Role } from '../../audio/sfx';
import { resetFrogs, runFrogs, stepFrogs } from '../../director/frogs';
import { check, openLevel } from '../../game/actions';
import { useGame } from '../../game/store';
import { levels } from '../../levels/catalog';

// The sound lab (dev only, open with ?sfx-lab): for every sound the game
// makes, the candidate clips from sfx-lab/ (made from Kenney's packs), and
// buttons that set off the real moment in a level, so each clip is heard with
// its motion. Picks are kept in this browser; "Copy picks" gives the list.
// A role's first candidate is the game's own clip (when it has one).

interface Candidate {
  id: string;
  pack: string;
  file: string;
}

const LEVEL_ID = 'step-by-two';
const NONE = 'none';
const KEY = 'invariant-frog:sfx-lab';
/** The game's own choice for a role: its first candidate, or none when the role has no clip. */
const ownOf = (role: Role, list: Candidate[]) => (hasOwnClip(role) ? list[0].id : NONE);
const level = () => levels.find((l) => l.id === LEVEL_ID)!;
const setFormula = (text: string) => useGame.getState().setFormula(text);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The lab's level is open (opening it if not). */
async function inLevel() {
  if (useGame.getState().level?.id === LEVEL_ID) return;
  openLevel(level());
  await sleep(900);
}

const ACTIONS = {
  hatch: { label: 'Hatch an egg', run: async () => (resetFrogs(), void stepFrogs()) },
  step: { label: 'Step', run: async () => void stepFrogs() },
  run: { label: 'Run', run: async () => (resetFrogs(), void runFrogs()) },
  showArea: {
    label: 'Show area',
    run: async () => {
      setFormula('');
      await sleep(500);
      setFormula(level().solutions[0]);
    },
  },
  clearArea: { label: 'Clear area', run: async () => setFormula('') },
  checkRight: {
    label: 'Check (right)',
    run: async () => {
      setFormula(level().solutions[0]);
      await check();
    },
  },
  checkWrong: {
    label: 'Check (wrong)',
    run: async () => {
      setFormula(level().pitfalls![0].formula);
      await check();
    },
  },
};
type Action = keyof typeof ACTIONS;

const ROLES: { role: Role; title: string; when: string; actions: Action[] }[] = [
  { role: 'click', title: 'Button click', when: 'Any button press (not the lab’s own)', actions: [] },
  { role: 'hop', title: 'Hop', when: 'Frogs take off; the pitch climbs with each hop of a run', actions: ['step', 'run'] },
  { role: 'land', title: 'Land', when: 'Frogs land; also a frog the hand drops on a tile', actions: ['step', 'run'] },
  { role: 'settle', title: 'All stopped', when: 'Every frog has stopped: the loop is over', actions: ['run'] },
  { role: 'goal', title: 'Goal pool', when: 'A frog lands in a goal pool', actions: ['run'] },
  { role: 'crack', title: 'Egg cracks', when: 'An egg cracks (then the hop clip, higher, as the frog pops out)', actions: ['hatch'] },
  { role: 'rise', title: 'Area rises', when: 'Slabs come up as the formula becomes valid', actions: ['showArea'] },
  { role: 'sink', title: 'Area sinks', when: 'Slabs go down', actions: ['clearArea'] },
  { role: 'patter', title: 'Frog shower', when: 'Many frogs dropped at once after a passing check', actions: ['checkRight'] },
  { role: 'chime', title: 'Rule proved', when: 'Each proved rule: three notes climbing', actions: ['checkRight'] },
  { role: 'fail', title: 'Counterexample', when: 'The scene marks where the area breaks', actions: ['checkWrong'] },
  { role: 'cleared', title: 'Level cleared', when: 'After the shower, once the level is done', actions: ['checkRight'] },
];

type Picks = Partial<Record<Role, string>>;

function loadPicks(): Picks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** A role's candidates by pack (in order of first appearance), with "none" last. */
function groups(list: Candidate[]): [string, Candidate[]][] {
  const by = new Map<string, Candidate[]>();
  for (const c of list) by.set(c.pack, [...(by.get(c.pack) ?? []), c]);
  return [...by, ['', [{ id: NONE, pack: '', file: 'none' }]]];
}

const buffers = new Map<string, Promise<AudioBuffer>>();
const clip = (id: string) => {
  if (!buffers.has(id)) buffers.set(id, loadClip(`/sfx-lab/${id}.m4a`));
  return buffers.get(id)!;
};

/** Make the game play `id` for `role` (the first candidate is the game's own clip). */
async function apply(role: Role, id: string | undefined, own: string) {
  if (!id || id === own) overrideRole(role, undefined);
  else if (id === NONE) overrideRole(role, null);
  else overrideRole(role, await clip(id));
}

export function SfxLab() {
  const [cands, setCands] = useState<Record<Role, Candidate[]> | null>(null);
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void inLevel();
    fetch('/sfx-lab/candidates.json')
      .then((r) => r.json())
      .then((c: Record<Role, Candidate[]>) => {
        setCands(c);
        for (const [role, id] of Object.entries(loadPicks())) void apply(role as Role, id, ownOf(role as Role, c[role as Role]));
      });
  }, []);

  const pick = async (role: Role, id: string) => {
    const next = { ...picks, [role]: id };
    setPicks(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // kept for this visit
    }
    await apply(role, id, ownOf(role, cands![role]));
    previewRole(role);
  };

  const copyPicks = () => {
    if (!cands) return;
    const lines = ROLES.map(({ role }) => {
      const id = picks[role] ?? ownOf(role, cands[role]);
      const c = cands[role].find((x) => x.id === id);
      return `${role}: ${c ? `${c.pack} / ${c.file}` : 'none'}`;
    });
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="fixed top-20 right-3 bottom-3 z-50 flex w-95 flex-col overflow-hidden rounded-2xl border border-line bg-white/95 text-sm shadow-float backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex-1">
          <div className="font-display text-base font-semibold">Sound lab</div>
          <div className="text-xs text-muted">Pick a clip to hear it; the buttons play it in the scene.</div>
        </div>
        <button data-silent className="cursor-pointer rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white" onClick={copyPicks}>
          {copied ? 'Copied' : 'Copy picks'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {!cands && <div className="py-4 text-muted">Loading candidates… (run the lab setup if this stays: sfx-lab/ is missing)</div>}
        {cands &&
          ROLES.map(({ role, title, when, actions }) => {
            const own = ownOf(role, cands[role]);
            const chosen = picks[role] ?? own;
            return (
              <section key={role} className="border-b border-line py-3 last:border-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display font-semibold">{title}</h3>
                  <span className="text-xs text-faint">{role}</span>
                </div>
                <p className="mb-2 text-xs text-muted">{when}</p>
                {actions.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {actions.map((a) => (
                      <button
                        key={a}
                        data-silent
                        className="cursor-pointer rounded-full border border-brand/40 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/8"
                        onClick={() => void inLevel().then(ACTIONS[a].run)}
                      >
                        ▶ {ACTIONS[a].label}
                      </button>
                    ))}
                  </div>
                )}
                {/* a long list is grouped by pack */}
                {groups(cands[role]).map(([pack, list]) => (
                  <div key={pack} className="mb-1.5">
                    {cands[role].length > 10 && <div className="mb-1 text-[11px] text-faint">{pack || 'Silence'}</div>}
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((c) => (
                        <button
                          key={c.id}
                          data-silent
                          title={c.pack ? `${c.pack} / ${c.file}` : 'No sound'}
                          className={`cursor-pointer rounded-lg px-2 py-1 font-mono text-xs transition-colors ${
                            chosen === c.id ? 'bg-ink text-white' : 'bg-shade/6 text-ink hover:bg-shade/12'
                          }`}
                          onClick={() => void pick(role, c.id)}
                        >
                          {c.file.replace(/\.ogg$/, '').replace(/^jingles_/, '')}
                          {c.id === own && <span className="ml-1 opacity-60">·now</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
      </div>
    </div>
  );
}
