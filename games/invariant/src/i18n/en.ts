import type { Rule } from '../checker/types';

export const en = {
  and: ' and ',
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
      'Your area claims that every frog is always on it. Initialization and Maintenance make the claim true; Termination makes it strong enough to prove the postcondition, for every input.',
    initialization: 'Every egg is on your area.',
    maintenance: 'No hop leads off your area.',
    termination: 'Every striped tile on your area is a goal.',
    inCode: 'In the code',
    initializationCode: 'After `requires` and the code before the loop, the `assert` holds.',
    maintenanceCode: 'If the `assert` and the loop condition hold, the `assert` holds again after the body.',
    terminationCode: 'If the `assert` holds and the loop condition is false, the `ensures` holds.',
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
    otherAnswers: (list: string) => `Other answers that work: ${list}.`,
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
    predictedRight: 'Right! ',
    whatIf: (pitfall: string, question: string) => `Before we move on: what if we had tried \`${pitfall}\`? ${question}`,

    hello:
      'Hi. This is a game about **loop invariants**: a way to prove that a loop works for every input, even when there are infinitely many.\n\nIn this tutorial you’ll prove a small loop correct. First, the world it lives in.',
    letsGo: 'Let’s go',
    frog: 'Each frog is the program, run on one input. The tile it sits on is its **program state**, the current values of its variables: `i = 0, n = 3`.\n\nEach axis of the plane stands for one variable.',
    program: 'Here is the program’s **code**. The loop runs its body again and again while `i < n`.',
    pressStep: 'Press **Step** to run the loop body once.',
    keepStepping: 'One hop is the loop body running once: `i` went from `0` to `1`.\n\nKeep pressing **Step** until the frog stops.',
    stops:
      'Now `i < n` is false (`3 < 3`), so the loop ends and the frog **stops**.\n\n- The striped tiles are where the loop stops.\n- Hover over (or tap) any tile to see where a frog there would hop.',
    stopsTag: 'stops: 3 < 3 is false',
    eggs: 'Where can a frog start? `var i = 0` sets `i` to `0`, and the **precondition**, `requires n >= 0`, lets `n` be any number from `0` up.\n\nEach **egg** is one place a frog can start.',
    eggsTag: 'starts at i = 0, n = 2',
    goals:
      'The **postcondition**, `ensures i == n`, is what must be true once the loop ends. The tiles where it holds are the **goals**, the amber pools.\n\nThe frog you stepped stopped on one, at `i = 3, n = 3`.',
    goalsTag: 'stopped on a goal',
    bug: 'Not every place to stop is a goal. A frog that stopped here, at `i = 3, n = 1`, would leave the loop with `i ≠ n`: the program would be wrong.\n\nFor the program to be correct, **every frog must stop on a goal**.',
    bugTag: 'stops, but i ≠ n',
    pressRun: 'Does every frog really stop on a goal? Let’s test it. Press **Run** to hatch the first ten eggs and run their frogs at once.',
    allTen: 'All ten stopped on a goal, so the program works for `n` = 0 to 9.',
    endless:
      'But that was only ten inputs. `n` can be any number, so the eggs never end: however many you test, infinitely many are left.\n\nClick a few more eggs to run them. They all work… but no amount of testing covers every egg. **So how can we be sure about all of them?**',
    testedTag: 'tested: n = 0 to 9',
    endlessTag: 'n = 18, 19, … never end',
    detour: 'There is a way to be sure about every egg without running a single frog. It’s easier to see on another loop first, so let’s leave ours for a moment.',

    exWorld:
      'Here is another loop. Its frogs hatch on the left and zigzag up and down, one column after another, until the loop stops in the stripes on the right.\n\nIts goals are the amber pools. Not every striped tile is one.',
    exArea:
      'These blue slabs are an **invariant area**. An area is a claim: **every frog is always somewhere on it**, from the moment it hatches, after every hop, for as long as the loop runs.\n\nAs a condition, this one is `0 <= x <= 4 && 0 <= y <= 4`.',
    exBadTag: 'stops, but not a goal',
    exWhy:
      'Why does that help? A frog that stopped on one of these striped tiles would stop off a goal, and the program would be wrong.\n\nBut they are off the area. If the claim is true, no frog can ever get there.',
    exEndings:
      'On the area, the loop can only stop in this one column, and every tile of it is a goal. So if the claim is true, **every frog stops on a goal**.\n\nNotice that this never followed a single frog. That is why the same reasoning works when the eggs never end.',
    exEndingTag: 'a possible ending',
    exRules:
      'So everything rests on the claim, and three things make it work:\n\n1. every egg is on the area,\n2. no hop leads off the area, and\n3. every striped tile on the area is a goal.\n\nThe first two make the claim true; the third makes it prove the program correct. These are the three rules of a loop invariant: **Initialization**, **Maintenance** and **Termination**.',
    exRule1Tag: '1 · every egg is on it',
    exRule2Tag: '2 · no hop leads off it',
    exRule3Tag: '3 · every stop on it is a goal',
    backToOurs: 'Back to our loop',

    draw: 'Back to our loop, and this time you draw the area. Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**.\n\nTry something like `i == 2`, `i % 2 == 0` or `i < n`. **Syntax**, below the box, lists what you can write.',
    assert:
      'In the code, your area is an `assert` at the top of the loop: a condition claimed to hold every time the loop comes round, before each hop and once more when it stops.\n\nNow let’s make your claim pass the three rules, one at a time.',

    ruleInitialization:
      '**Rule 1 · Initialization:** every egg is on your area. Then the claim is already true before the first hop.\n\nIn the code: after `requires n >= 0` and `var i = 0`, the `assert` holds.',
    askInitialization: 'Change your area so **every egg is on it**, then press **Check**.',
    nudgeInitialization: 'Every egg has the same `i`. What is it?',
    passedInitialization: 'Correct! Every egg is on your area: **Initialization** holds.',
    questionInitialization: 'Would every egg be on it?',
    afterDemoInitialization: (mine: string) => `\`i == n\` only covers the egg at \`n = 0\`. Yours, ${mine}, covers them all.`,
    afterOwnInitialization: (mine: string) => `Your first try missed an egg. ${mine} covers them all.`,

    ruleMaintenance:
      '**Rule 2 · Maintenance:** no hop leads off your area. From any tile of it where the loop goes on, one hop lands on it again.\n\nIn the code: if the `assert` holds and `i < n`, then after `i = i + 1` the `assert` holds again.',
    askMaintenance: 'Change your area so **no hop leads off it**, and keep every egg on it. **Check** now tests rules 1 and 2.',
    nudgeMaintenance: 'Every frog starts at `i = 0`, and a hop only ever increases `i`.',
    ghostMaintenance:
      'The see-through frog is a **ghost frog**. Check never runs real frogs; for every tile of your area it asks: if a frog were here, where would it land? No real frog may ever get here, but your area says one could.',
    passedMaintenance:
      'Correct! No hop leads off your area: **Maintenance** holds.\n\nThe see-through frogs are **ghost frogs**. Check never runs real frogs. It asks every tile of your area at once: if a frog were here, where would it land? Every answer is on your area.',
    questionMaintenance: 'Would every hop from it land on it?',
    afterDemoMaintenance: 'Frogs pass through every tile in between, so those tiles have to be on the area too.',
    afterOwnMaintenance: 'Frogs pass through every tile in between, so those tiles have to be on your area too.',

    together:
      'Together, rules 1 and 2 make your claim true, just like in the example. A frog starts on your area, and no hop takes it off, so it never leaves, however many hops it makes.\n\nThat’s why it’s called an **invariant**: it stays true from hop to hop.',
    stillOnTag: 'still on your area',
    neverLeaves: 'When the loop stops, the frog is still on your area. Does that mean it stops on a goal?',

    ruleTermination: (endings: string) =>
      `**Rule 3 · Termination:** every striped tile on your area is a goal. A frog never leaves your area, so the outlined tiles are the only places one can stop, like the column in the example. ${endings}\n\nIn the code: if the \`assert\` holds and \`i < n\` is false, the \`ensures\` holds.`,
    endingsAllGoals: 'For your area, they are all goals.',
    endingsSomeNot: 'For your area, the red ones are not goals.',
    confirmTermination: 'Press **Check** to confirm it: it now tests all three rules.',
    askTermination: 'Change your area so **every striped tile on it is a goal**, then press **Check**: it now tests all three rules.',
    nudgeTermination: 'A real frog never passes `n`, so `i` is never greater than `n`.',
    objection:
      '“But `i` never passes `n`!” True, no real frog gets here. But Check never runs real frogs: where they go is exactly what we are trying to prove. All it knows is your area, and your area says a frog could be here. **Shrink** your area so it doesn’t.',
    objectionDemo:
      '“But `i` never passes `n`!” True, no real frog gets here. But Check never runs real frogs: where they go is exactly what we are trying to prove. All it knows is the area, and this one says a frog could be here.',
    passedTermination: 'Correct! Every striped tile on your area is a goal: **Termination** holds.',
    questionTermination: 'Would it pass all three rules?',
    afterDemoTermination: (mine: string) =>
      `\`i >= 0\` is a true claim: every real frog keeps \`i ≥ 0\`. But it is too weak to prove the postcondition, because it leaves room to stop off a goal. Yours, ${mine}, is strong enough.`,
    afterOwnTermination: (mine: string) =>
      `Your earlier area was a true claim, but too weak to prove the postcondition. ${mine} is strong enough.`,

    twoWays:
      'So an area can be wrong in two ways:\n\n- Too **small**, and it isn’t true: an egg is off it, or a hop leads off it. Initialization or Maintenance fails.\n- Too **large**, and it isn’t strong enough: it leaves room to stop off a goal. Termination fails.\n\nThe invariant sits between. Shrinking an area is called **strengthening** it.',
    tooSmallTag: 'too small: egg off it',
    tooLargeTag: 'too large: stops off a goal',

    wrapUp: (mine: string) =>
      `Your area ${mine} passes all three rules:\n\n- **Initialization:** every egg is on it.\n- **Maintenance:** no hop leads off it.\n- **Termination:** every striped tile on it is a goal.\n\nSo every frog stops on a goal, for every \`n\`: infinitely many inputs, proved without running any of them.`,
    finish: 'Finish',
  },
};

export type Messages = typeof en;
