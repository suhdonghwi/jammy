import type { Rule } from '../levels/level';

// Everything the game says in English, apart from the levels' own text (which
// lives with the levels in catalog.ts). ko.ts says the same in Korean, key for
// key: its type is this file's.

export const en = {
  /** Joins the last two names of a list: `i, j and n`. */
  and: ' and ',

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
    /** A failed rule light replays its counterexample. */
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
      'An area that passes all three is a loop invariant strong enough to prove the postcondition: every frog that stops, stops on a goal — for every input.',
    initialization: 'Every egg sits on your area.',
    maintenance: 'A frog on your area that hops lands on your area.',
    termination: 'A frog that stops on your area is on a goal.',
    gotIt: 'Got it',
  },

  syntax: {
    title: 'Writing a condition',
    compare: 'Compare',
    combine: 'Combine',
    arithmetic: 'Arithmetic',
    functions: 'Functions',
    arrays: 'Arrays',
    constants: 'Constants',
    gotIt: 'Got it',
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
    landsOutside: (from: string, to: string, area: string) => `From ${from}, one hop lands at ${to} — outside ${area}.`,
    offGoalTag: 'stops, but not on a goal',
    offGoal: (state: string) => `A frog that stops at ${state} doesn't meet the postcondition.`,
  },

  /** The parts of the formula language's errors a learner can run into while typing an area. */
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
    /** A prediction that was right, whichever way the answer went. */
    predictedRight: 'Right! ',

    passedInitialization: 'Correct! Every egg sits on your area: the first rule holds.',
    passedMaintenance: 'Correct! No hop leaves your area: the second rule holds. A frog anywhere on it lands on it again.',
    passedTermination: 'Correct! Every frog that stops on your area is on a goal: the third rule holds.',
    whatIf: (pitfall: string, question: string) => `Before we move on: what if we had tried \`${pitfall}\`? ${question}`,
    objection:
      '“But `i` never passes `n`!” — Your area doesn’t say that. It claims a frog could be on any of its tiles, so every one of them is checked, even tiles no real frog reaches. To fix it, **shrink** your area so it stops claiming impossible frogs.',
    objectionDemo:
      '“But `i` never passes `n`!” — The area doesn’t say that. It claims a frog could be on any of its tiles, so every one of them is checked, even tiles no real frog reaches. The fix would be to **shrink** it so it stops claiming impossible frogs.',

    hello:
      'Hi. This is a game about **loop invariants**. A loop invariant is a way to rigorously prove that a loop works correctly for every input.\n\nIn this tutorial, you’ll write one yourself and use it to prove a loop correct. First, the world the game takes place in.',
    letsGo: 'Let’s go',
    frog: 'Each frog is the program, run on some input. The tile it sits on is its **program state**, the current values of its variables: `i = 0, n = 3`.\n\nEach axis of the plane stands for one variable, and where the frog sits is the values of its variables.',
    program: 'Here is the program’s **code**. The loop runs its body again and again while `i < n`.',
    contracts:
      'Two lines you may not have seen.\n\n- `requires` is the **precondition**: what we assume about the input. Here, `n` is never negative.\n- `ensures` is the **postcondition**: what must be true once the loop has finished. Here, `i` must have reached `n`.',
    pressStep: 'Press **Step** to run the loop body once.',
    keepStepping: 'One hop = the loop body running once: `i` went from `0` to `1`.\n\nKeep pressing **Step** until the frog stops.',
    stops:
      'Now `i < n` is false (`3 < 3`), so the loop ends and the frog **stops**.\n\n- The shaded tiles are where the loop stops.\n- Hover over (or tap) any tile to preview where a frog there would hop.',
    stopsTag: 'stops: 3 < 3 is false',
    eggs: 'Where can a frog start? The program sets `i` to `0`, and the precondition lets `n` be any number `≥ 0`.\n\nEach **egg** is one starting state: a place a real frog begins.',
    eggsTag: 'starting state: i = 0, n = 2',
    goals:
      'The amber pools are the **goals**: the tiles where the postcondition `i == n` holds.\n\nThe frog you stepped stopped on one, at `i = 3, n = 3`.',
    goalsTag: 'stopped on a goal',
    bug: 'Not every place to stop is a goal. A frog that stopped here, at `i = 3, n = 1`, would leave the loop with `i ≠ n`: the program would be wrong.\n\nFor the program to be correct, **every frog must stop on a goal**.',
    bugTag: 'stops, but i ≠ n',
    pressRun: 'Does every frog really stop on a goal? Let’s test it. Press **Run** to hatch the first ten eggs and run their frogs at once.',
    allTen: 'All ten stopped on a goal, which means the program is correct for `n` = 0 to 9.',
    endless:
      'But that was only ten inputs. `n` can be any number, so the eggs never end: however many you test, infinitely many are left.\n\nClick a few more eggs to run them. They all work… but testing can never cover them all. **So how can we be sure the program is correct for every egg?**',
    testedTag: 'tested: n = 0 to 9',
    endlessTag: 'n = 18, 19, … never end',
    invariant:
      'To *prove* it for every input, you need a condition that is true every time the program reaches the top of the loop.\n\nThat condition is called a **loop invariant**. In this world, a loop invariant shows up as an **area** of the plane. An area has to pass three checks; we’ll take them one at a time.',
    draw: 'Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**.\n\nTry something like `i == 2`, `i % 2 == 0` or `i < n`. **Syntax**, below the box, lists what you can write.',

    askInitialization:
      'First rule: every egg must sit on your area, because the condition must already hold before the first hop.\n\nDraw an area every egg sits on, then press **Check**.',
    nudgeInitialization: 'Every egg has the same `i`. What is it?',
    questionInitialization: 'Would every egg sit on it?',
    afterDemoInitialization: (mine: string) =>
      `**Rule 1 · Initialization**: every egg sits on your area. \`i == n\` only covers the egg at \`n = 0\`; yours, ${mine}, covers them all.`,
    afterOwnInitialization: (mine: string) =>
      `**Rule 1 · Initialization**: every egg sits on your area. Your first try missed one; ${mine} covers them all.`,

    askMaintenance:
      'Now the hop. A frog on your area must land on your area, every time.\n\nKeep every egg on it, and make sure no hop leaves it. **Check** now runs rules 1 and 2.',
    nudgeMaintenance: 'Every frog starts at `i = 0`, and a hop only ever increases `i`.',
    explainMaintenance: 'The see-through frog is a **ghost frog**: not a real one, but a frog placed on a tile of your area to check it. Your area said a frog could be there.',
    questionMaintenance: 'Would every hop from it land on it?',
    afterDemoMaintenance:
      '**Rule 2 · Maintenance**: a frog on your area that hops lands on your area. Frogs pass through the tiles in between!\n\nA **ghost frog** can start on *any* tile of your area, not only ones real frogs reach. Your area is a claim about where frogs can be, and **Check** tests the whole claim.',
    afterOwnMaintenance:
      '**Rule 2 · Maintenance**: a frog on your area that hops lands on your area.\n\nA **ghost frog** can start on *any* tile of your area, not only ones real frogs reach. Your area is a claim about where frogs can be, and **Check** tests the whole claim.',
    extraMaintenance: 'The see-through frog is a **ghost frog**: not a real one, but a frog placed on a tile of your area to check it.',

    followOne: 'Both rules hold for your area. Let’s follow one frog to see what that means.',
    startsOn: 'It starts on your area: that’s **Initialization**.',
    startsOnTag: 'Initialization',
    everyHop: 'Every hop lands on your area again: that’s **Maintenance**.',
    stillOnTag: 'still on your area',
    neverLeaves:
      'So it can never leave your area, no matter how many hops. That makes your area an **invariant**: true every time the program reaches the top of the loop.\n\nWhen the loop stops, the frog is still somewhere on your area. But what we need to show is that it stops on a **goal**. Does stopping on your area mean stopping on a goal?',

    /** The answer to neverLeaves' question when the learner's area is already strong enough. */
    stopsAllGoals:
      'For your area, yes. Look at the outlined tiles: they are on your area and the loop stops there, so they are where a frog can end up. Every one is a goal.\n\nThat is the third rule: every frog that stops on your area is on a goal.',
    /** The answer when it isn't: some of those tiles (outlined in red) are off a goal. */
    onlyIfGoal:
      'For your area, no. Look at the outlined tiles: they are on your area and the loop stops there, so they are where a frog can end up. The red ones are not goals.\n\nThe third rule says every one of them must be a goal.',
    confirmTermination: 'Press **Check** to confirm it: it now runs all three rules.',
    askTermination: 'Change your area so every frog that stops on it is on a goal, then press **Check**: it now runs all three rules.',
    nudgeTermination: 'A real frog never passes `n`, so `i` is never greater than `n`.',
    questionTermination: 'Would it pass all three rules?',
    afterDemoTermination:
      '**Rule 3 · Termination**: a frog that stops on your area is on a goal. `i >= 0` is a true invariant — every real frog does keep `i ≥ 0` — but too weak to prove the goal.',
    afterOwnTermination: (mine: string) =>
      `**Rule 3 · Termination**: a frog that stops on your area is on a goal. Your earlier area was a true invariant, but too weak to prove the goal; ${mine} is strong enough.`,

    twoWays:
      'There are two ways a loop invariant can be wrong.\n\n- Too **small** an area, and an egg or a hop falls outside: Initialization or Maintenance fails.\n- Too **large**, and it claims frogs that stop off a goal: Termination fails.\n\nThe invariant sits between. Shrinking an area is called **strengthening** it.',
    tooSmallTag: 'too small: egg outside',
    tooLargeTag: 'too large: stops off a goal',

    wrapUp: (mine: string) =>
      `Your area ${mine} passes all three rules:\n\n- **Initialization:** every egg sits on it.\n- **Maintenance:** no hop leaves it.\n- **Termination:** every frog that stops on it is on a goal.\n\nIt is a loop invariant strong enough to prove the postcondition: every frog that stops, stops on a goal — for every \`n\`, without running a single one.`,
    finish: 'Finish',
  },
};

export type Messages = typeof en;
