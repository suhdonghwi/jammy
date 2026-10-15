// Build-time level validation: every level parses, every solution is proved,
// every pitfall fails, real frogs terminate, and the Korean text matches.
import { checkFormula } from '../src/checker/check';
import { nodeZ3, shutdownZ3 } from '../src/checker/z3-node';
import type { State } from '../src/lang/ast';
import { allLevels, tutorialLevel } from '../src/levels/catalog';
import { levelsKo } from '../src/levels/catalog.ko';
import { compileFormula, compileLevel, hop, isEgg, running, startState, type CompiledLevel, type LevelDef } from '../src/levels/level';

const ctx = await nodeZ3();
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

/** A few arrays of each small length: ascending, descending, and a couple of fixed patterns. */
function sampleArrays(n: number): bigint[][] {
  const up = Array.from({ length: n }, (_, k) => BigInt(k - 1));
  const down = [...up].reverse();
  const bumpy = Array.from({ length: n }, (_, k) => BigInt((k * 7) % 5 - 2));
  const flat = Array.from({ length: n }, () => 2n);
  return [up, down, bumpy, flat];
}

function sampleEggs(level: CompiledLevel): State[] {
  const eggs: State[] = [];
  const vals = Array.from({ length: 13 }, (_, k) => BigInt(k - 4));
  const go = (k: number, s: State) => {
    if (k === level.freeDims.length) {
      const st = startState(level, s);
      if (isEgg(level, st)) eggs.push(st);
      return;
    }
    const d = level.freeDims[k];
    const len = level.arrays[d];
    if (len) {
      // the array's length was chosen before it (its length input is declared first)
      const n = Number(s[len]);
      if (n < 0 || n > 6) return;
      for (const a of sampleArrays(n)) go(k + 1, { ...s, [d]: a });
    } else for (const v of vals) go(k + 1, { ...s, [d]: v });
  };
  go(0, {});
  return eggs;
}

/** A hint points the way; typing the answer is the learner's job. */
function checkHints(def: LevelDef, hints: string[]) {
  for (const h of hints) {
    const quoted = [...h.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\s+/g, ''));
    const given = def.solutions.find((sol) => quoted.includes(sol.replace(/\s+/g, '')));
    if (given) fail(`hint gives away solution '${given}': ${h}`);
  }
}

/** The Korean text says as much as the English: the same hints and pitfall messages, in the same order. */
function checkKorean(def: LevelDef) {
  const ko = levelsKo[def.id];
  if (!ko) return fail('no Korean text in catalog.ko.ts');
  const count = (what: string, en = 0, k = 0) => en !== k && fail(`${en} ${what} in English but ${k} in Korean`);
  count('hints', def.hints?.length, ko.hints?.length);
  count('pitfall messages', def.pitfalls?.length, ko.pitfalls?.length);
  if (!!def.intro !== !!ko.intro) fail(`intro in ${def.intro ? 'English' : 'Korean'} only`);
  checkHints(def, ko.hints ?? []);
}

for (const id of Object.keys(levelsKo)) {
  if (!allLevels.some((l) => l.id === id)) fail(`catalog.ko.ts has text for unknown level '${id}'`);
}

for (const def of allLevels) {
  console.log(`${def.id} ${def.title}`);
  checkKorean(def);
  let level: CompiledLevel;
  try {
    level = compileLevel(def);
  } catch (e) {
    fail(`does not compile: ${(e as Error).message}`);
    continue;
  }
  if (def !== tutorialLevel) {
    if ((def.hints?.length ?? 0) < 2) fail('needs at least two hints');
    checkHints(def, def.hints ?? []);
  }
  const box = { cx: 0, cy: 0, r: 12, planeR: 8, plane: def.planes?.start };

  const eggs = sampleEggs(level);
  if (eggs.length === 0) fail('no starting states');
  for (const e of eggs) {
    let s = e;
    let k = 0;
    while (running(level, s) && k < 500) {
      s = hop(level, s);
      k++;
    }
    if (k >= 500) {
      fail(`frog from ${JSON.stringify(e, (_, v) => (typeof v === 'bigint' ? Number(v) : v))} does not stop`);
      break;
    }
  }

  for (const sol of def.solutions) {
    const f = compileFormula(level, sol);
    if (!f.ok) {
      fail(`solution '${sol}' does not compile: ${f.error.message}`);
      continue;
    }
    const t = performance.now();
    const r = await checkFormula(ctx, level, f, box, { timeout: 5000 });
    const ms = Math.round(performance.now() - t);
    const bad = Object.entries(r.verdicts).filter(([, v]) => v.status !== 'pass' || v.how !== 'proved');
    if (bad.length) fail(`solution '${sol}': ${bad.map(([k, v]) => `${k}=${v.status}`).join(', ')}`);
    else console.log(`  ✓ solution '${sol}' (${ms} ms)`);
  }

  for (const p of def.pitfalls ?? []) {
    const f = compileFormula(level, p.formula);
    if (!f.ok) {
      fail(`pitfall '${p.formula}' does not compile: ${f.error.message}`);
      continue;
    }
    const r = await checkFormula(ctx, level, f, box, { timeout: 5000 });
    const failed = Object.entries(r.verdicts).filter(([, v]) => v.status === 'fail').map(([k]) => k);
    const undecided = Object.entries(r.verdicts).filter(([, v]) => v.status === 'undecided').map(([k]) => k);
    if (failed.length === 0) fail(`pitfall '${p.formula}' does not fail`);
    else if (undecided.length) fail(`pitfall '${p.formula}' has undecided rules: ${undecided}`);
    else if (r.pitfall?.formula !== p.formula) fail(`pitfall '${p.formula}' not recognized as itself`);
    else console.log(`  ✓ pitfall '${p.formula}' fails ${failed.join(', ')}`);
  }
}

await shutdownZ3();
if (failures) {
  console.log(`\n${failures} problem(s)`);
  process.exit(1);
}
console.log('\nall levels valid');
process.exit(0);
