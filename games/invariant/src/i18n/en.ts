import type { Rule } from '../checker/types';

export const en = {
  gotIt: 'Got it',

  rules: {
    initialization: 'Initialization',
    maintenance: 'Maintenance',
    termination: 'Termination',
  } satisfies Record<Rule, string>,

  home: {
    tagline: 'A little game about loop invariants',
    pitch: "How do you know if your loop is correct for every input? Let's find that out, with frogs.",
    tutorial: 'Tutorial',
    levels: 'Levels',
    back: 'Back',
    language: 'Language',
    cleared: 'Cleared',
    clearedCount: (n: number, of: number) => `${n} of ${of} levels cleared`,
    resetTitle: 'Forget which levels you have cleared',
    resetConfirm: 'Reset progress?',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    source: 'Source on GitHub',
  },

  topBar: {
    home: 'Home',
    allLevels: 'All levels',
  },

  caption: {
    back: 'Back',
    next: 'Next',
    replay: 'Replay',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
  },

  code: {
    title: 'Code',
  },

  formula: {
    replay: 'Replay the counterexample',
    area: 'area',
    placeholder: (names: string) => `condition on ${names}`,
    check: 'Check',
  },

  controls: {
    rules: 'Rules',
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    reset: 'Reset',
    resetTitle: 'Put every frog back in its egg (your area stays)',
    hint: 'Hint',
    hintTitle: "A nudge for when you're stuck",
    syntax: 'Syntax',
    syntaxTitle: 'What you can type into the area box',
  },

  inputs: {
    title: 'Inputs',
    decrease: (name: string) => `${name} down by one`,
    increase: (name: string) => `${name} up by one`,
    random: (name: string) => `A random ${name}`,
    impossible: 'not a possible input',
  },

  hover: {
    impossible: 'not a possible state',
    hopsTo: (to: string) => `hops to ${to}`,
    stopsOnGoal: 'stops · goal ✓',
    stops: 'stops here',
    inArea: 'in the area',
    outsideArea: 'outside the area',
  },

  rulesCard: {
    title: 'The three rules',
    intro:
      'With Initialization and Maintenance, every frog always stays on your area. Add Termination, and every frog stops on a goal.',
    initialization: 'Every egg is on the area.',
    maintenance: 'Every hop lands on the area.',
    termination: 'Every stop on the area is a goal.',
  },

  syntax: {
    title: 'Writing a condition',
    compare: 'Compare',
    combine: 'Combine',
    arithmetic: 'Arithmetic',
    functions: 'Functions',
    arrays: 'Arrays',
    constants: 'Constants',
  },

  level: {
    hint: (k: number, of: number) => `**Hint ${k} of ${of}.**`,
    anotherHint: 'Another hint',
    undecided: "I couldn't find a frog that breaks this nearby — but I couldn't prove it either.",
    avoidDivision: ' Try avoiding division — for example `2 * s == …` instead of `s == … / 2`.',
    proved: 'Proved. Every frog, everywhere you claimed — for every input.',
    next: (title: string) => `Next: ${title}`,
    backToLevels: 'Back to levels',
    otherAnswers: (count: number): string => (count > 1 ? 'Other answers that work:' : 'Another answer that works:'),
  },

  verdicts: {
    solverFailed: (why: string) => `The solver could not start: ${why}`,
    far: 'Everything nearby looked fine — but far away: ',
    yourArea: 'your area',
    theArea: 'the area',
    noLongerHolds: (part: string) => ` \`${part}\` no longer holds.`,
    falseThere: (part: string) => ` \`${part}\` is false there.`,
    startsOutsideTag: (area: string) => `starts outside ${area}`,
    startsOutside: (state: string, area: string) => `This frog starts at ${state} — outside ${area}.`,
    landsOutsideTag: (area: string) => `lands outside ${area}`,
    landsOutside: (from: string, to: string, area: string) => `A ghost frog at ${from} hops to ${to}, outside ${area}.`,
    eggLandsOutside: (from: string, to: string, area: string) => `The frog from the egg at ${from} hops to ${to}, outside ${area}.`,
    realLandsOutside: (egg: string, from: string, to: string, area: string) =>
      `The frog from the egg at ${egg} gets to ${from}, and its next hop lands at ${to}, outside ${area}.`,
    offGoalTag: 'stops, but not on a goal',
    holdsTag: {
      initialization: 'every egg is on the area',
      maintenance: 'every hop lands on the area',
      termination: 'every stop on the area is a goal',
    } satisfies Record<Rule, string>,
    offGoal: (state: string) => `A ghost frog at ${state} stops there, but it isn't a goal: the postcondition doesn't hold.`,
    realOffGoal: (egg: string, state: string) => `The frog from the egg at ${egg} stops at ${state}, but it isn't a goal: the postcondition doesn't hold.`,
  },

  langErrors: {
    anArea: 'an area',
    aCondition: 'a condition',
    bothBranches: 'both branches',
    anIndex: 'an index',
    aBound: 'a bound of the range',
    isArray: (name: string) => `${name} is an array: write a cell of it, like \`${name}[0]\``,
    notArray: (name: string) => `${name} is a number, not an array`,
    nameTaken: (name: string) => `'${name}' is already a name here; pick another for the bound name`,
    quantRange: (q: string) => `${q} needs a range, like \`${q} 0 <= k < n: …\``,
    quantName: 'The names in the middle of the range are the bound names, like `k` in `0 <= k < n`',
    needsNumber: (text: string, ctx: string) => `\`${text}\` is true/false, but ${ctx} needs a number`,
    needsCondition: (text: string, ctx: string) => `\`${text}\` is a number, but ${ctx} needs a true/false condition`,
    didYouMean: (text: string, what: string) => `\`${text}\` is a number, but ${what} needs a true/false condition. Did you mean \`${text} == 0\`?`,
    unknownName: (name: string, names: string) => `Unknown name '${name}'. You can use: ${names}`,
    arity: (fn: string, n: number) => `${fn} takes ${n} argument${n > 1 ? 's' : ''}`,
    positiveDivisor: (op: string) => `'${op}' only works with a positive number on the right, like \`x ${op} 2\``,
    unexpectedChar: (c: string) => `Unexpected character '${c}'`,
    expectedEnded: (text: string) => `Expected '${text}' but the input ended`,
    expectedFound: (text: string, found: string) => `Expected '${text}' but found '${found}'`,
    expected: (text: string) => `Expected '${text}'`,
    expectedNameEnded: 'Expected a name but the input ended',
    expectedNameFound: (found: string) => `Expected a name but found '${found}'`,
    notHere: (word: string) => `'${word}' can't be used here`,
    unknownFunction: (name: string) => `Unknown function '${name}'. Available: abs, min, max`,
    endsEarly: 'The formula ends too early',
    unexpected: (found: string) => `Unexpected '${found}'`,
    empty: 'Type a condition',
  },

  tutorial: {
    hint: 'Hint:',
    undecided: "I couldn't prove that either way. Try a simpler formula.",
    lostRule: (rule: string) => `${rule} held a moment ago; this change lost it. `,
    fixAndCheck: 'Fix your area and press **Check** again.',
    trying: (f: string) => `Trying \`${f}\`…`,
    guessedRight: 'Right, no. ',
    guessedWrong: 'Not quite. ',

    whatIf: (pitfall: string, question: string) => `Before we move on: what if we had tried \`${pitfall}\`? ${question}`,

    hello:
      'Hi. This is a game about **loop invariants**, which are used to prove that a loop works correctly for every input.\n\nIn this tutorial you’re going to prove a small loop correct. First, the world it lives in.',
    letsGo: 'Let’s go',
    frog: 'Each frog stands for the program, run on one input. The tile it sits on is its **program state**, the current values of its variables.',
    program: 'Here is the **code** of the program we are running. The loop runs its body again and again while `i < n`.',
    pressStep: 'Press **Step** to run the loop body once.',
    keepStepping: 'One hop is the loop body running once: `i` went from `0` to `1`.\n\nKeep pressing **Step** until the frog stops.',
    stops: 'Now `i < n` is false (`3 < 3`), so the loop ends and the frog **stops**. The striped tiles are where the loop stops.',
    stopsTag: 'stops: 3 < 3 is false',
    eggs: 'Where can a frog start? The **precondition** is what we assume about the input. Here, the precondition `requires n >= 0` lets `n` be any number from `0` up.\n\nEach **egg** is one place a frog can start.',
    eggsTag: 'starts at i = 0, n = 2',
    goals:
      'The **postcondition**, `ensures i == n`, is the condition that must hold once the loop ends. The tiles where it holds are the **goals**, the amber pools.\n\nThe frog you stepped stopped on one, at `i = 3, n = 3`.',
    goalsTag: 'stopped on a goal',
    bug: 'Not every place to stop is a goal. A frog that stopped here, at `i = 3, n = 1`, would leave the loop with `i ≠ n`: the program would be wrong.\n\nFor the program to be correct, **every frog must stop on a goal**.',
    bugTag: 'stops, but i ≠ n',
    pressRun: 'Does every frog really stop on a goal? Let’s test it. Press **Run** to hatch ten eggs.',
    allTen: 'All ten frogs stopped on a goal, which means the program works for `n` = 0 to 9.',
    endless:
      'But that was only ten inputs. `n` can be any number, so the eggs never end: however many you test, infinitely many are left.\n\n**So how can we be sure the program works for every egg?**',
    testedTag: 'tested: n = 0 to 9',
    endlessTag: 'n = 18, 19, … never end',
    detour: 'There is a way to be sure about every egg without hatching infinitely many of them. Let’s leave our loop for a moment.',
    exWorld: 'Here is another loop. Its frogs hatch and hop straight to the right until they reach the stripes, where they stop.\n\nThis loop’s eggs never end either: they go on up and down forever.',
    exArea:
      'These blue slabs are an **invariant area**. Drawing an area is claiming that **“every tile a frog ever lands on is on this area.”**',
    exBadTag: 'stops, but not a goal',
    exWhy:
      'Why does that help? If a frog stopped on one of these red tiles, it would stop off a goal, and the program would be wrong.\n\nBut these tiles are off the area. If every frog is always on the area, as it claims, no frog can ever reach them.',
    exEndings: 'On the area, the loop can only stop in this one column, and every tile of it is a goal. So if the claim that frogs only ever move on the area is true, **every frog stops on a goal**.',
    exEndingTag: 'a possible ending',
    exRules:
      'So all it takes is three things:\n\n- **Initialization:** every egg is on the area.\n- **Maintenance:** no hop leads off the area.\n- **Termination:** every striped tile on the area is a goal.\n\nThen every frog is proved to stop on a goal.',
    backToOurs: 'Back to our loop',

    draw: 'Back to our loop, and this time you draw the area. Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**.\n\nTry something like `i == 2`, `i % 2 == 0` or `i < n`.',
    askInitialization: '**Rule 1 · Initialization:** every egg must be on your area.\n\nChange your area so **every egg is on it**, then press **Check**.',
    nudgeInitialization: 'Every egg has the same `i`. What is it?',
    passedInitialization: 'Correct! Every egg is on your area: **Initialization** holds.',
    questionInitialization: 'Is every egg on it?',
    afterDemoInitialization: (mine: string) => `\`i == n\` only covers the egg at \`n = 0\`, while yours, ${mine}, covers every egg.`,
    afterOwnInitialization: (mine: string) => `Your first try missed an egg, but ${mine} covers every egg.`,

    ruleMaintenance: 'Next rule.\n\n**Rule 2 · Maintenance:** no hop leads off your area. From any tile of it, one hop lands on it again.',
    askMaintenance: 'Now change your area so **no hop leads off it**. **Check** tests rules 1 and 2 together.',
    nudgeMaintenance: 'Every frog starts at `i = 0`, and a hop only ever increases `i`.',
    ghostMaintenance:
      'The see-through frog is a **ghost frog**. Check never runs real frogs; for every tile of your area it asks: if a frog were here, where would it land? No real frog may ever get here, but your area says one could.',
    passedMaintenance:
      'Correct! No hop leads off your area: **Maintenance** holds.\n\nThe see-through frogs are **ghost frogs**. Check never runs real frogs. It asks every tile of your area at once: if a frog were here, where would it land? Every answer is on your area.',
    questionMaintenance: 'Does every hop from the area land on the area?',

    together:
      'With rules 1 and 2 together, a frog never leaves your area: every frog starts on it, and no number of hops takes it off.\n\nThat’s why it’s called an **invariant**: with every hop the state changes, but “it is on the area” stays true.',
    stillOnTag: 'still on your area',

    leadTermination:
      'When it reaches a striped tile and the loop stops, the frog is still on your area. The outlined tiles are where a frog can stop on this area.\n\n**So does a frog that stops on the area always stop on a goal?** Making sure of that is the third rule.',

    askTermination:
      '**Rule 3 · Termination:** every striped tile on your area must be a goal.\n\nChange your area so **every striped tile on it is a goal**, then press **Check**. It now tests all three rules.',
    nudgeTermination: 'A real frog never passes `n`, so `i` is never greater than `n`.',
    objection:
      '“But `i` can never pass `n`!” Indeed, no real frog gets to this tile. But your area claims “a frog could be here too”. The area is too large.',
    objectionDemo:
      '“But `i` can never pass `n`!” Indeed, no real frog gets to this tile.\n\nBut the area `i >= 0` claims “a frog could be on any tile where `i >= 0`”. Checking that claim covers tiles where `i` is greater than `n` too.',
    passedTermination: 'Correct! Every striped tile on your area is a goal: **Termination** holds.',
    questionTermination: 'Would it pass all three rules?',
    afterDemoTermination: (mine: string) =>
      `\`i >= 0\` isn’t a false claim in itself: every real frog keeps \`i >= 0\`. But it leaves room for a frog to stop off a goal, so it is too weak to prove the postcondition.\n\nYour area ${mine}, on the other hand, is strong enough to prove it.`,
    afterOwnTermination: (weak: string, mine: string) =>
      `Your earlier area ${weak} was a true claim too, but it left room to stop off a goal, so it was too weak to prove the postcondition.\n\nYour area ${mine}, on the other hand, is strong enough to prove it.`,
    twoWays:
      'So two things can keep an area from proving the program:\n\n- It fails **rules 1 and 2**, so its claim isn’t proved: an egg is off it, or a hop leads off it, even from a tile no real frog reaches.\n- It fails **rule 3**: its claim may be true, but it is too **weak**, leaving room to stop off a goal.\n\nThe area that proves the program passes all three.',
    notProvedTag: 'not proved: egg off it',
    tooWeakTag: 'too weak: stops off a goal',

    wrapUp: (mine: string) =>
      `Your area ${mine} passes all three rules:\n\n- **Initialization:** every egg is on it.\n- **Maintenance:** no hop leads off it.\n- **Termination:** every striped tile on it is a goal.\n\nSo every frog stops on a goal. You’ve proved our loop correct for infinitely many inputs! 🎉`,
    finish: 'Finish',
  },
};

export type Messages = typeof en;
