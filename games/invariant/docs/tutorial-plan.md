# Invariant Frog — Tutorial overhaul plan

A new tutorial, from the ground up. **Built:** `src/tutorial/steps.ts` follows
the script below, and `src/tutorial/script.ts` holds the stage, demo and
prediction machinery; this document is the reference for why it is the way it
is. The "The tutorial" section of [design.md](design.md) summarises it; the
rest of design.md (the world, the rules, the hand, the checker) is unchanged.

Playtesting: `?step=N` on the URL starts the tutorial at step N.

See also [experience.md](experience.md) for pacing and motion rules, which
still apply, and [architecture.md](architecture.md) for how steps are written.

## Why

A review of the current tutorial (played end to end, and against the script in
`src/tutorial/steps.ts`) found:

- **The learner never decides anything.** Every attempt accepts exactly one
  formula. Typing `i <= n`, a listed solution for the level, is refused with
  "type exactly `i == n`". The rationale for each formula is given in the
  caption before the attempt, so the learner doesn't form the hypothesis
  either. Then the first level says "you are on your own now".
- **No bridge to what programmers already know.** The program's `requires` and
  `ensures` are never explained; "precondition" and "postcondition" appear
  late and unannounced; the word "invariant" appears only in the last caption.
  Nothing says *an invariant is an assert at the top of the loop that never
  fires*.
- **The ending defines "invariant" wrongly.** It calls `0 <= i <= n` a loop
  invariant by contrast with `i >= 0`. Both are invariants; one is too weak to
  prove the goal. Strengthening, which every later level relies on, only makes
  sense once "true but too weak" is a thing.
- **Metaphors go unexplained.** The purple test frog is never introduced; the
  slabs are never named as the formula drawn on the plane; the axes have no
  variable names; eggs are called "inputs" (wrong from Parity on).
- **Too many names per concept.** Goal / "what we want" / `ensures` /
  postcondition. Area / formula / condition / invariant.

## What a learner should leave with

Design.md's list, plus the two the old tutorial skipped:

- explain why testing can't prove a loop correct for all inputs;
- state the three rules in their own words;
- explain why Maintenance must hold even for states real runs never reach;
- strengthen an invariant to fix a failing rule;
- **choose a formula themselves**, having done it three times with feedback;
- **know the shape of the search:** too small fails Initialization or Maintenance, too
  large fails Termination, the invariant sits between.

## Principles

1. **Any formula is a valid move.** The checker runs for real on whatever the
   learner types; the story branches on *which rule failed*, never on which
   formula was typed. There are only four outcomes per attempt, and each has a
   scripted response.
2. **One rule at a time.** Each stage asks a small, concrete question ("an area
   every egg sits on") and checks only the rules introduced so far. The learner
   is never asked for "the invariant"; it emerges by strengthening.
3. **Every failure is witnessed, by the learner or by the hand.** If the
   learner's formula fails the stage's rule, that is the witness. If it passes,
   the hand demonstrates the stage's pitfall formula instead. Every learner sees
   all three failures.
4. **Predict before you see.** Before each hand demo the learner commits to a
   guess (passes / fails, and which rule). A guess costs one click.
5. **One hint, never the answer.** A stuck learner can ask for one sentence
   that names the fact that matters, without giving the formula.
6. **Say what things are, once, with the code word next to the world word.**
   Then keep one name each. See the vocabulary below.
7. **Pacing rules from experience.md still hold:** caption first, then the
   scene change; Next is always clickable; Back always works; only what the
   step asks for is enabled.

## Vocabulary

One name per concept. The "first said" column is the beat where the tutorial
defines it; after that the name is used without explanation.

| Concept | Name in the world | Code word | First said |
|---|---|---|---|
| One run of the program | a **frog** | | 1.1 |
| Program state (its variable values) | the **tile** a frog sits on | | 1.1 |
| One loop iteration | a **hop** | | 1.3 |
| `requires` | the **precondition**: what we assume about the input | `requires` | 1.2b |
| States a run can start from | **eggs**: starting states | | 1.5 |
| `ensures` | the **postcondition**: what must hold when the loop has finished | `ensures` | 1.2b |
| Tiles where the postcondition holds | **goals** | | 1.6 |
| Loop guard false | "the loop **stops** here" (no "striped") | `while (…)` | 1.4 |
| The learner's formula | the **area**; it *is* the **loop invariant** | an assert at the loop head | 1.9 |
| Raised tiles | **slabs**: the tiles where the formula is true | | 1.10 |
| The checker | the **hand** | | 2.1 |
| A hypothetical state the hand places | a **test frog** (purple); real frogs are green | | 2.2 |
| Passes Initialization and Maintenance | "an **invariant**" | | 2.6 |
| Also passes Termination | "**strong enough** to prove the postcondition" | | 2.8 |
| Shrinking the area | **strengthening** | | 2.8 |
| A state that breaks a rule | "a frog that breaks it" | | 2.1 |

Rule names are the textbook ones from CLRS: **Initialization**, **Maintenance**,
**Termination**. One name each, everywhere (lights, captions, rules card); no
short forms and no aliases. Termination means *when the loop terminates*, not a
termination proof; the rule's own sentence ("a frog that stops on your area is
on a goal") carries that, so it gets no qualifier.

Dropped: "input" for eggs, "striped", "condition" as a noun for the formula
(the placeholder becomes "a condition on `i` and `n`"), "Show me", "proved the
loop correct" (replaced by "every run that stops, stops on a goal").

## The script

Same program as today: `i` from `0` up to `n`. Four acts, about 12–15
minutes. Captions below are the intended wording; concrete values and
spotlights as in the current script unless noted.

### Act 1 — The world

**1.0 Hello.** Bare plane, nothing else.

> Hi. This is a game about **loop invariants**: the way to prove a loop
> correct for *every* input, not just the ones you happened to try.
>
> In about fifteen minutes you'll write one and have it checked. First, the
> world it lives in.

Button: "Let's go".

**1.1 A frog and its tile.** The axes appear (the numbered row and column as
a band, each named in the corner before its 0; new), and one frog with its
tag.

> This frog is one run of the program. The tile it sits on is its **state**:
> `i = 0, n = 3`. The plane's two axes are the two variables, so where the
> frog sits *is* its values.

The axes stay on for the rest of the tutorial and in levels.

**1.2a The program.** Code panel appears, spotlit.

> Here is the program. The loop runs its body again and again while `i < n`.

**1.2b Two lines you may not have seen.** Spotlight lines 2 and 9 in turn.

> `requires` is the **precondition**: what we assume about the input. Here,
> `n` is never negative.
>
> `ensures` is the **postcondition**: what must be true once the loop has
> finished. Here, `i` must have reached `n`.

**1.3 Step.** As today: press Step once ("one hop = one run of the loop
body"), then until the frog stops.

**1.4 Stops.** As today, with the callout "stops: 3 < 3 is false" and the
hover hint. Caption says "the shaded tiles are where the loop stops", not
"striped".

**1.5 Eggs.**

> Where can a run start? The program sets `i` to `0`, and the precondition
> lets `n` be any number `≥ 0`. Each **egg** is one starting state: a place a
> real run begins.

Callout on one egg: "starting state: i = 0, n = 2".

**1.6 Goals.** The frog stepped in 1.3 is back on `(3, 3)`, its tile outlined
"stopped on a goal".

> The amber pools are the **goals**: the tiles where the postcondition
> `i == n` holds. The frog you stepped stopped on one, at `i = 3, n = 3`. That
> run did what `ensures` promises.

**1.6b What a bug would look like.** This is the motivation for everything
that follows, so it gets its own beat and a picture: a failure marker on a stop
tile that is not a goal, "stops, but i ≠ n".

> Not every place to stop is a goal. A run that stopped here, at
> `i = 3, n = 1`, would leave the loop with `i ≠ n`: the program would be
> wrong. So the question is: **does every run stop on a goal?**

**1.7 Test some.** Run hatches the first ten eggs (`n` = 0 to 9).

> Let's test it. Press **Run** to hatch the first ten eggs and run their frogs
> at once.

Then: "All ten stopped on a goal. For `n` = 0 to 9, the program is correct."
Exactly what was shown, and no more.

**1.8 Testing can't be enough.** The ten frogs stay on their goals while the
camera zooms out: a label marks them "tested: n = 0 to 9", and further up the
column, where the eggs carry on, "n = 18, 19, … never end". The learner can
click a few more eggs.

> But that was ten inputs. `n` can be any number, so the eggs never end:
> however many you test, infinitely many are left. Click a few more eggs to
> run them. They all work… but testing can never cover them all. **So how can
> we be sure about every one?**

**1.9 The bridge.** Camera back in. The code panel shows a ghost line at the
top of the loop body: `assert(?);` (new reveal flag). All three rule lights
appear in the top bar, dim.

> If you could prove it instead of watching, you'd want a condition that is
> true every time a run reaches the top of the loop, for every run. An
> `assert` here that never fires.
>
> That condition is called a **loop invariant**. In this world it is an
> **area** of the plane: the tiles where the condition is true. An area has to
> pass three checks; we'll take them one at a time.

**1.10 Draw before you check.** Formula box appears; Check stays disabled.

> Type any condition on `i` and `n`. The tiles where it's true rise as
> **slabs**. That is the `assert(?)` drawn on the plane. Try something like
> `i == 2`, `i % 2 == 0` or `i < n`. **Syntax**, below the box, lists what
> you can write.

Next appears after the first valid formula. Hover readout shows "in your
area / outside your area" as today. No suggestion placeholder here; the
placeholder reads "a condition on `i` and `n`".

### Act 2 — The three rules, one at a time

Each stage follows the same shape: **ask → attempt → outcome → witness →
name the rule**. The attempt loop is specified in full under "The attempt
loop" below; the stages here only give the wording and the pitfall.

**2.1 Stage 1: every egg.** The Initialization light wakes (the other two stay dim).
The hand needs no introduction of its own: it appears at the first failure
or demo, and the captions name it then.

> First rule: every egg must sit on your area, because the assert runs before
> the first hop. Draw an area every egg sits on, then press **Check**.

Check runs **Initialization** only. Pitfall for the demo: `i == n`.

- *Fails Initialization:* the hand hatches the egg outside (as today). Caption names the
  frog and the rule, then "Fix your area and Check again." Loop.
- *Passes:* the pass beat (eggs tagged) → predict → demo `i == n` → the
  counterexample. Then:

> **Rule 1 · Initialization**: every egg sits on your area. `i == n`
> only covers the egg at `n = 0`.

**2.2 Stage 2: every hop.** The Maintenance light wakes.

> Now the hop. A frog on your area must land on your area, every time.
> Check now runs rules 1 and 2.

Check runs **Initialization + Maintenance**. Pitfall: `i == 0 || i == n`.

- *Fails Initialization:* "Rule 1 held a moment ago; this change lost it." Replay the
  egg outside. Loop.
- *Fails Maintenance:* the hand places a purple frog and hops it out (as
  today). The first time a purple frog appears, a callout rides with it:
  "**test frog**: a state the hand imagines". Caption: "From `…`, one hop
  lands at `…` — outside your area." Loop.
- *Passes:* the pass beat (a light shower) → predict → demo
  `i == 0 || i == n` → counterexample ("frogs pass through the tiles in
  between").

Then name it:

> **Rule 2 · Maintenance**: a frog on your area that hops lands on your area.
> The hand may start the test frog on *any* tile of your area, not only ones a
> real run reaches. Your area is a claim, and the hand tests the claim.

**2.3 Follow one frog.** With the learner's current formula (whatever passed).
As today: hatch at `(0, 3)`, "it starts on your area: that's Initialization"; step it,
"every hop lands on your area again: that's Maintenance"; then:

> So it can never leave your area, no matter how many hops. That makes your
> area an **invariant**: true every time a run reaches the top of the loop.
>
> When the loop stops, the frog is still somewhere on your area. Is that
> enough?

**2.4 Stage 3: stopping on a goal.** First the answer to 2.3's "Is that
enough?", before any checking: the Termination light wakes, the frog from 2.3
stays on the goal it stopped on, and every stop tile on the learner's area is
outlined (the only places a run on it can end). The learner can see for
themselves whether one lacks an amber pool.

> Only if that tile is a goal. A run ends where the loop stops: on a shaded
> tile, and on your area — one of the outlined tiles.
>
> Third rule: every one of them must be a goal.

Then the learner presses Check (all three rules), as in the other stages:

> Is every one a goal? Press **Check**: it now runs all three rules. If a frog
> stops off a goal, change your area and Check again.

(It used to check the area automatically, with only a one-line rule before
it. A learner whose area already passed got "Correct!" without reading the
rule or doing anything.)

Pitfall: `i >= 0`.

- *Fails Termination:* the hand places a test frog on a stop tile that is not a goal
  (as today), with the objection paragraph:

  > "But `i` never passes `n`!" — Your area doesn't say that. It claims a frog
  > could be anywhere on it, and the hand takes you at your word. To fix it,
  > **shrink** your area so it stops claiming impossible frogs.

  The pitfall line from the level ("Real frogs never pass n — but your area
  allows it") is dropped here; it duplicates the paragraph. Loop: the learner
  edits and Checks again (all three rules).
- *Passes:* the pass beat (stop tiles tagged) → predict → demo `i >= 0` →
  the counterexample with the same objection paragraph.

**2.5 Too small, too large.** Once the learner's area passes all three.

> **Rule 3 · Termination**: a frog that stops on your area is on a goal.
>
> Notice the two ways to be wrong. Too **small** an area and an egg or a hop
> falls outside: Initialization or Maintenance fails. Too **large** and it claims frogs
> that stop off a goal: Termination fails. The invariant sits between. Shrinking it
> is called **strengthening**.

Callouts: one egg ("too small: egg outside") and one stop tile off the goals
("too large: stops off a goal"), from the two demos just seen.

### Act 3 — Wrap-up

**3.1 Rain.** As today, on the learner's formula.

**3.2 Recap**, naming their formula:

> Your area `<their formula>` passes all three rules:
>
> - **Initialization:** every egg sits on it.
> - **Maintenance:** no hop leaves it.
> - **Termination:** every frog that stops on it is on a goal.
>
> It is a loop invariant strong enough to prove the postcondition: every run
> that stops, stops on a goal — for every `n`, without watching any of them.

Button: Finish.

**3.3 Rules card.** Updated text (see "UI changes"). Closing it opens
Countdown (the first level), whose intro becomes: "Same idea, but this frog counts down. Start with an
area every egg sits on, and strengthen from there."

## The attempt loop

One stage = `stage(gen, { ask, rules, nudge })`. It replaces
`attempt()` and the `expected` / `tutorialCheck` gate.

**Check** is enabled whenever the stage is waiting. Pressing it compiles the
formula and runs the checker on `rules` (cumulative: stage 1 `['init']`, stage
2 `['init', 'pres']`, stage 3 all three). Outcomes:

| Outcome | Response |
|---|---|
| Parse or type error | As in levels: the box shows the error and shakes; no caption change. |
| A rule fails | The hand plays the counterexample for the *first* failing rule in order. The caption names the frog and the rule. If the failing rule is from an earlier stage, prefix "Rule *k* held a moment ago; this change lost it." Then wait for Check again. |
| Undecided | Cannot happen on this program (no `*` between variables); if it ever does, the hand shrugs and asks for a simpler formula. |
| All current rules pass | Lights go green; the pass beat shows the rule's evidence in the scene; then `predict` → `demo(pitfall)`. Then the stage ends. |

A stage ends only on a pass. There is no attempt limit.

**Hint.** A quiet "Hint" button in the row under the area box (replacing "Show
me"). Pressing it adds one sentence under the stage's ask, and the button
goes; it comes back with the next stage.

- stage 1: "Every egg has the same `i`. What is it?"
- stage 2: "Every frog starts at `i = 0`, and a hop only ever increases `i`."
- stage 3: "A real frog never passes `n`, so `i` is never greater than `n`."

Each points at the fact that matters about real runs, but never gives the
formula: turning it into one is the learner's job.

(It used to be a ladder: a second press suggested a formula, with Tab to fill
it in, and a third filled it in. Cut to the one sentence.)

**Pass.** When a stage passes, a beat opens with "Correct!" in the success
tone and shows the rule's own evidence in the scene before anything else
happens: green outlines and a green wash on the eggs (Initialization), a light shower
of test frogs that all land on the area again (Maintenance), the same marks
on the area's stop tiles (Termination). No tags: the caption says what they show.
Then Next.

**Predict.** A yes-or-no question, with Yes and No as buttons that carry a
green tick and a red cross. While it is asked, the pitfall formula sits in
the area box and its slabs are on the plane, so the learner answers by
looking at the area; afterwards the learner's own area comes back.

> Before we move on: what if we had tried `i == n`? Would every egg sit on
> it? **✓ Yes** · **✕ No**

The hand is not named here (the learner may not have met it yet). The
counterexample's caption opens with the verdict, "Right, no." in the success
tone or "Not quite." in the failure tone, then says what the frog did ("this
frog starts at … — outside the area"); the rule's explanation follows on
Next.
For stage 3, the question is "Would it pass all three rules?". Predictions
are never scored or remembered; they exist to make the learner commit. They
are plain buttons, not clicks in the scene, and the demo cannot be skipped: a
learner who passes every stage first try still sees all three failures,
because the demos are where the rules get their names.

**Demo.** `demo(gen, formula, rule)`: the learner's formula is saved; unless
the box already shows `formula` (it does, after a prediction), the hand comes
in and the box types it out character by character (slabs follow, as when
the learner types); the checker runs; the counterexample plays with its
Replay button; Next restores the learner's formula and slabs. The box is
read-only during a demo.

## UI and engine changes

Scene and HUD:

- **Axes** (`floorShader.ts` and `scene/labels/AxisLabels.tsx`): the floor
  tints the row and the column of numbers as a soft band, and each axis's
  name is written where its numbers are, in the corner of the tile before the
  0, so the row reads "i → 0 1 2 3" and the column "n ↑ 0 1 2 3". Like the
  numbers it hides nothing. Lines were tried and collided with the stop
  boundary, which runs in the same tile gaps; chips covered tiles; chips that
  followed the camera were distracting; a per-tile compass on hover was
  fiddly. On in levels too.
- **Ghost assert line** in the code panel: a reveal flag `assert` draws
  `assert(?);` as the loop body's first line, dimmed and indented like the
  body. It never shows the formula itself: the panel is narrow and
  invariants get long, and the area box below is where the formula lives.
  Levels show it too.
- **Rule lights** get a third look besides shown/hidden: *dim* (revealed but
  not yet checked in the tutorial, greyed) and *awake* (the current stage's
  rule and all earlier ones, as today). `reveal.lights`
  stays the list of visible lights; a new `reveal.awake` lists the awake ones.
  Levels show all three awake, as today.
- **Test-frog callout** the first time a purple frog appears in the tutorial.
- **Hint** button and its state (`hint` in the store, set per stage); "Show
  me" and `suggestion` go away.
- **Caption choices**: `Caption.choices?: { label; onClick }[]` rendered as
  secondary buttons, for `predict`.
- **Syntax card**: a reference for the formula language (compare, chain,
  combine, arithmetic, functions, constants), with examples in the open
  level's own variables. Opened from a **Syntax** button at the right end of
  the row under the area box (next to Hint, when there is one), shown once
  the area box exists; in levels too.
- **Rules card** text:
  - subtitle: "An area that passes all three is a loop invariant strong enough
    to prove the postcondition: every run that stops, stops on a goal."
  - Initialization: "Every egg sits on your area."
  - Maintenance: "A frog on your area that hops lands on your area."
  - Termination: "A frog that stops on your area is on a goal."
- Formula placeholder: "a condition on `i` and `n`" (from the level's view
  names).

Tutorial engine (`src/tutorial/`):

- `script.ts`: remove `expected`, `tutorialCheck`'s exact-match gate and
  `suggestion`; add `stage()`, `predict()`, `demo()`, and the hint. Check
  in tutorial mode calls the stage's pending resolver with the compiled formula.
- `steps.ts`: the beats above. Each step still declares its starting scene;
  stages declare `formula: 'learner'` meaning "whatever the learner last had",
  stored in the tutorial's own state so Back restores it.
- `director/verdicts.ts`: `playCounterexample` gains an option to suppress the
  level pitfall line (stage 3) and a `prefix` for the regression case.
- Checker: unchanged. `checkFormula` already takes a rule subset.

Levels and docs:

- `catalog.ts`: Countdown's intro as above. Pitfall messages stay for the
  levels; the tutorial's own explanations replace them in every stage.
- `design.md`: replace "The tutorial" with a pointer to this plan (or fold the
  Principles and Vocabulary sections in once built).

## Decisions

Questions that came up while planning, and the answers this plan goes with:

- **Lights before their stage.** All three lights appear dim at 1.9, when the
  caption says "three checks", so the learner knows what is coming; each wakes
  as its stage begins. (Not: one light per stage, which left the top bar
  changing shape with no explanation.)
- **Experienced learners.** No "skip demo". Passing every stage first try
  takes about three extra minutes for the three demos, and the demos are where
  the rules are named and the test frog is introduced. A learner who already
  knows all this can leave by the back arrow at any time.
- **Prediction by clicking the scene.** Buttons only (Passes / Fails). Clicking
  an egg or a tile to answer "which one is missed?" would be more engaging but
  needs new input handling; revisit after the first version has been played.
- **Stage 2 regressions.** A learner who keeps breaking Initialization while fixing
  Maintenance is not special-cased; the regression prefix names the lost
  rule, and the stage-2 hint points at what fixes both. Watch for it in
  playtests.
