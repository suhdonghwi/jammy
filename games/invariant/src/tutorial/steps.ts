import { hatchFrog, resetFrogs, stepFrogs } from '../director/frogs';
import { sleep } from '../director/sequence';
import { playCounterexample, playRain, runChecker } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';
import { EXIT_MS } from '../ui/presence';
import { allow, attempt, beat, failureOf, guard, holdCaption, nextAfterCounterexample, say, waitEvent } from './script';

// The story, as steps. Each step knows the scene it starts from, so Back can
// rebuild it and replay the step; moving forward just runs the next one.

/** A tutorial state (i, n). */
export const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
const realFrogsStopped = () => frogWorld.frogs.filter((f) => f.kind === 'real').every((f) => f.stopped);

/** What the scene looks like when a step begins. */
export interface Scene {
  reveal: Partial<Reveal>;
  /** Real frogs (as (i, n)) already on the board. */
  frogs?: [number, number][];
  /** Frogs carry their value tags. */
  tags?: boolean;
  formula?: string;
  /** Camera target tile and distance. */
  camera?: [number, number, number];
}

interface Step {
  scene: Scene;
  run: (gen: number) => Promise<void>;
}

const BASE = { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true, run: true, formula: true } as const;

export const STEPS: Step[] = [
  // ---------------- Act 1: The world ----------------
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(gen, 'This frog is a **program state**. It sits at `i = 0, n = 3`: its position on the plane *is* its values.', {
        prepare: async () => {
          useGame.getState().setReveal({ axes: true });
          // the frog's own tag shows its values (and animates them as it hops)
          useGame.setState({ frogTags: true });
          hatchFrog(st(0, 3));
          await sleep(600);
        },
      }),
  },
  {
    scene: { reveal: { axes: true }, frogs: [[0, 3]], tags: true },
    run: (gen) =>
      beat(gen, 'Here is the **program**. The loop runs its body again and again while `i < n`.', {
        spot: 'code',
        prepare: () => useGame.getState().setReveal({ code: true }),
      }),
  },
  {
    scene: { reveal: { axes: true, code: true }, frogs: [[0, 3]], tags: true },
    run: async (gen) => {
      useGame.getState().setReveal({ step: true });
      allow({ step: true });
      say('Press **Step** to run the loop body once.', 'step');
      await waitEvent(gen, 'stepped');
      say('One hop = one run of the loop body: `i` went from `0` to `1`.\n\nKeep pressing **Step** until the frog stops.', 'step');
      await waitEvent(gen, 'stepped', realFrogsStopped);
      allow({});
    },
  },
  {
    scene: { reveal: { axes: true, code: true, step: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(
        gen,
        'Now `i < n` is false (`3 < 3`), so the loop ends and the frog **stops**.\n\n- Striped tiles are where the loop stops.\n- Hover over any tile to preview where a frog there would hop.',
        {
          prepare: () => useGame.getState().setReveal({ stop: true, hover: true }),
          settle: 1000,
          callouts: [{ x: 3, y: 3, text: 'stops: 3 < 3 is false', tone: 'info' }],
        },
      ),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(gen, 'Where can frogs start? Anywhere the **precondition** allows: `i` starts at `0`, and `n` can be any number `≥ 0`.\n\nEach **egg** is one possible input.', {
        callouts: [{ x: 0, y: 2, text: 'egg: input n = 2', tone: 'info' }],
        prepare: () => {
          resetFrogs();
          useGame.setState({ frogTags: false });
          useGame.getState().setReveal({ eggs: true });
        },
        settle: 1100,
      }),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true } },
    run: (gen) =>
      beat(gen, 'What we want when the loop ends: `i == n`.\n\nThe amber pools are the **goals**. Every frog should finish on one.', {
        callouts: [{ x: 2, y: 2, text: 'goal: i == n', tone: 'info' }],
        prepare: () => useGame.getState().setReveal({ goals: true }),
        settle: 1000,
      }),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true } },
    run: async (gen) => {
      useGame.getState().setReveal({ run: true });
      useGame.setState({ callouts: [] });
      allow({ run: true });
      say('Press **Run** to hatch every egg and run all the frogs at once.', 'run');
      await waitEvent(gen, 'runDone', realFrogsStopped);
      allow({});
      await beat(gen, 'Every frog stopped on a goal. Looks correct!');
    },
  },
  {
    scene: { reveal: { ...BASE, formula: false } },
    run: async (gen) => {
      await beat(
        gen,
        'But how many eggs are there? `n` can be any number, so the eggs never end.\n\nClick a few eggs to run them: they all work… but watching them one at a time can never cover them all. **So how can we check them all?**',
        {
          prepare: async () => {
            resetFrogs();
            await cameraRig.lookAtTile(4, 14, 55);
            allow({ eggs: true });
          },
        },
      );
      allow({});
    },
  },
  {
    scene: { reveal: { ...BASE, formula: false }, camera: [4, 14, 55] },
    run: (gen) =>
      beat(
        gen,
        'Instead of watching frogs, we describe an **area** with a formula. If one area passes three checks, every frog is covered without watching any of them.\n\nLet’s take the checks one at a time.',
        {
          spot: 'formula',
          prepare: async () => {
            resetFrogs();
            await cameraRig.lookAtTile(2, 2, 15.6);
            useGame.getState().setReveal({ formula: true, lights: ['init'] });
          },
          settle: 500,
        },
      ),
  },

  // ---------------- Act 2: The area, one rule at a time ----------------
  // A — Init
  {
    scene: { reveal: { ...BASE, lights: ['init'] }, camera: [2, 2, 15.6] },
    run: async (gen) => {
      say('Simplest idea first: the area is just the goal.\n\nType `i == n` (press Tab to fill it in), then press **Check**.', 'check');
      const res = await attempt(gen, 'i == n', ['n == i'], ['init']);
      const cex = failureOf(res, 'init');
      if (cex) {
        await playCounterexample(cex, { prefix: 'This hand checks your area — it looks for a frog that breaks it. ', action: nextAfterCounterexample });
        guard(gen);
        await holdCaption(gen);
      }
    },
  },
  {
    scene: { reveal: { ...BASE, lights: ['init'] }, formula: 'i == n', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(gen, '**Rule 1 · Init:** every egg must sit on your area.\n\nOnly the egg at `n = 0` was on `i == n`.', {
        spot: 'lights',
        prepare: () => useGame.setState({ failMark: null }),
        callouts: [{ x: 0, y: 0, text: 'on your area', tone: 'good' }],
      }),
  },
  // B — Preservation
  {
    scene: { reveal: { ...BASE, lights: ['init'] }, formula: 'i == n', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ lights: ['init', 'pres'] });
      say('A frog is either at the start, or done.\n\nType `i == 0 || i == n`, then **Check**.', 'check');
      const res = await attempt(gen, 'i == 0 || i == n', ['i == n || i == 0'], ['init', 'pres']);
      const cex = failureOf(res, 'pres');
      if (cex) {
        await playCounterexample(cex, { action: nextAfterCounterexample });
        guard(gen);
        await holdCaption(gen);
      }
    },
  },
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres'] }, formula: 'i == 0 || i == n', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(gen, '**Rule 2 · Preservation:** a frog on your area that hops must land on your area.\n\nFrogs pass through the tiles in between!', {
        spot: 'lights',
      }),
  },
  // C — Init and Preservation hold; follow one frog; then Exit
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres'] }, formula: 'i == 0 || i == n', camera: [2, 2, 15.6] },
    run: async (gen) => {
      say('Frogs start at `i = 0` and only ever move right.\n\nType `i >= 0`, then **Check**.', 'check');
      await attempt(gen, 'i >= 0', ['0 <= i'], ['init', 'pres']);
      await beat(gen, 'Both rules hold for `i >= 0`. Let’s follow one frog to see what that means.', { spot: 'lights' });
    },
  },
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres'] }, formula: 'i >= 0', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(gen, 'It starts on your area: that’s **Init**.', {
        callouts: [{ x: 0, y: 3, text: 'Init', tone: 'good' }],
        prepare: async () => {
          resetFrogs();
          await cameraRig.lookAtTile(1.5, 3, 12);
          hatchFrog(st(0, 3));
          await sleep(600);
        },
      }),
  },
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres'] }, formula: 'i >= 0', frogs: [[0, 3]], camera: [1.5, 3, 12] },
    run: async (gen) => {
      say('Every hop lands on your area again: that’s **Preservation**.');
      for (let k = 0; k < 6 && !realFrogsStopped(); k++) {
        await sleep(650);
        guard(gen);
        await stepFrogs(true);
        guard(gen);
        // after the first landing, the label rides along with the frog
        const f = frogWorld.frogs.find((fr) => fr.kind === 'real');
        if (k === 0 && f) useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: 'still on your area', tone: 'good' }] });
      }
      await sleep(500);
      guard(gen);
      await beat(gen, 'So it can never leave your area, no matter how many hops. When the loop ends, it is still somewhere on your area.\n\nIs that enough?', {
        callouts: useGame.getState().callouts,
      });
    },
  },
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres'] }, formula: 'i >= 0', camera: [1.5, 3, 12] },
    run: async (gen) => {
      useGame.getState().setReveal({ lights: ['init', 'pres', 'exit'] });
      useGame.setState({ callouts: [] });
      resetFrogs();
      say('**Rule 3 · Exit:** a frog that stops on your area must be on a goal. Let’s check it.', 'lights');
      await sleep(1800);
      guard(gen);
      const exitRes = await runChecker(['exit']);
      guard(gen);
      const ev = exitRes?.verdicts.exit;
      if (ev?.status === 'fail') {
        await playCounterexample(ev.cex, {
          extra: '“But `i` never passes `n`!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand is just taking you at your word.',
          action: nextAfterCounterexample,
        });
        guard(gen);
        await holdCaption(gen);
      }
    },
  },
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres', 'exit'] }, formula: 'i >= 0', camera: [2, 2, 15.6] },
    run: (gen) => beat(gen, '**Rule 3 · Exit.** To fix it, shrink your area so it stops claiming impossible frogs.'),
  },
  // D — all three
  {
    scene: { reveal: { ...BASE, lights: ['init', 'pres', 'exit'] }, formula: 'i >= 0', camera: [2, 2, 15.6] },
    run: async (gen) => {
      say('Add what every real frog knows: it never passes `n`.\n\nType `0 <= i <= n`, then **Check**.', 'check');
      await attempt(gen, '0 <= i <= n', ['i >= 0 && i <= n', 'i <= n && i >= 0'], ['init', 'pres', 'exit']);
      await playRain();
      guard(gen);
      await beat(
        gen,
        'Your area passes all three rules:\n\n- **Init:** every egg starts on it.\n- **Preservation:** no hop leaves it.\n- **Exit:** every frog that stops on it is on a goal.\n\nThat area is a **loop invariant**, and you just proved the loop correct for every `n`.',
        { label: 'Finish' },
      );
      // the three rules, as a card; the tutorial ends (and the first level
      // opens) once it is closed, after its exit animation, not underneath it
      useGame.setState({ showRules: true });
      await new Promise<void>((resolve) => {
        const off = useGame.subscribe((s) => {
          if (!s.showRules) {
            off();
            resolve();
          }
        });
      });
      await sleep(EXIT_MS + 60);
    },
  },
];
