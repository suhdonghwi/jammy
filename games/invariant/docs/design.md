# Invariant Frog — Design Document

> An interactive, visual website that teaches programmers what **loop invariants** are — by drawing an area that frogs can never hop out of.

Status: v1 implemented · Last updated: 2026-10-15

---

## 1. Overview

Invariant Frog represents a program's **state space** as an endless white plane of tiles. Each tile is one program state. Running the program is a **frog** hopping between tiles: one hop per loop iteration.

The learner's job is to write a **formula** that describes an area of the plane — the loop invariant — and convince a skeptic (a round, minimal **hand**) that:

1. every frog **starts** inside the area,
2. no frog can **hop out** of the area while the loop is running, and
3. every frog that **stops** inside the area stops on a **goal**.

If all three hold, every frog — for every possible input — ends up on a goal. That is the loop-invariant proof rule, presented as a game.

### Audience

Programmers who write loops every day but have never (or only vaguely) met loop invariants. No logic or math background is assumed beyond boolean expressions.

### Learning goals

By the end of v1, a learner should be able to:

- explain why watching executions (testing) cannot prove a loop correct for all inputs;
- state the three conditions (Initialization, Preservation, Exit) in their own words;
- explain why Preservation must hold for states that are never reached in real runs;
- write and **strengthen** an invariant to fix a failing Preservation or Exit check;
- recognize the common shape *"a preserved equation + a bound"*.

---

## 2. Core concept

### 2.1 Mapping

| Program concept | On screen |
|---|---|
| Program state | A tile on the plane |
| One loop iteration | One frog hop |
| Loop guard true | Tile in the **continue** region (frogs keep hopping) |
| Loop guard false | Tile in the **stop** region (frogs sit still) |
| Precondition (after initialization code) | **Eggs** — where real frogs hatch |
| Postcondition | **Goal markers** (shown only in the stop region) |
| Loop invariant | The learner's **area**, drawn as raised **slabs** |
| An input that never changes (e.g. `n`) | A **pond**: one layer in a vertical stack |

### 2.2 The three rules

| Rule | Formal | Learner-facing wording |
|---|---|---|
| **Init** | `pre ⇒ Inv` (after init code) | Every egg must sit on your area. |
| **Preservation** | `Inv ∧ guard ⇒ Inv[body]` | A frog on your area that hops must land on your area. |
| **Exit** | `Inv ∧ ¬guard ⇒ post` | A frog that stops on your area must be on a goal. |

### 2.3 Why these three rules — the narrative

The site never leads with the rules. It earns them:

1. **Watching looks convincing.** The learner runs frogs and every one reaches a goal.
2. **Watching cannot be enough.** The camera zooms out; eggs continue into the fog forever. There are infinitely many inputs.
3. **Draw an area instead.** If we can show three things about one area, every frog is covered — without watching any of them.
4. **The induction argument, shown with one frog.** It hatches on a slab (Init). It hops and lands on a slab (Preservation). Again. Again. *"It starts on your area and no hop can leave it — so it never leaves."* It stops on a slab — *"is that enough?"* → Exit.

### 2.4 The adversary: why unreachable frogs matter

The most common objection: *"That frog could never actually be there!"*

Answer, embodied by **the hand**: *"Your area says frogs could be anywhere on it. I'm just taking you at your word."* The area is a **claim**, and the hand is allowed to test any part of the claim. If you don't want a frog there, shrink your claim — that is **strengthening**.

The hand is the only adversary. It has no face or name.

### 2.5 Inputs and stacked ponds

Most invariants mention an input (e.g. `n`) that the loop never modifies.

- Full state = `(inputs, loop variables)`. Inputs are a **direction frogs can never hop in**.
- So the state space is a **stack of independent ponds**, one per input value. A frog lives its whole life in one pond.
- All three checks decompose **per pond**: "prove it for every `n`" = "prove it in every pond". Showing one pond at a time loses nothing.

**Overlay rule.** If the guard, body, goal, and area do not depend on the input, every pond looks identical except for egg placement, so all ponds can be **merged into one plane with many eggs**. This is why single-plane levels (e.g. parity) have a whole region of eggs. When anything depends on the input, ponds differ and must be shown separately.

**Design rules for levels:**

1. **Inputs are never mutated.** Programs copy inputs into loop variables (`r = a`). The parser enforces this.
2. **The input part of the precondition decides which ponds exist.** If `pre: n >= 0`, pond `n = -1` does not exist and the hand can never use it. (Matches verifiers like Dafny, where facts about unmodified variables carry through loops.)
3. **Initialization code decides where the egg sits** in each pond.
4. v1 levels have **at most one input** (one slider).

---

## 3. Visual design

### 3.1 The world

- **Endless white plane**, off-white tiles, thin light-gray grid lines.
- **White fog**, no horizon line — zooming out reads as "it never ends".
- Soft isometric-ish camera; diffuse lighting; soft contact shadows (shadows carry the 3D in a white world).
- Clean, round, minimal style throughout. Frogs are the only characters; everything else is geometry.

### 3.2 Visual channels

| Element | Channel | Look |
|---|---|---|
| Continue region (guard true) | Tone | Plain white tiles |
| Stop region (guard false) | Tone | Light-gray tiles; thin line along the continue/stop boundary |
| Goal (postcondition) | Marker | Small clean symbol (ring/dot) on goal tiles, **stop region only** |
| Learner's area (invariant) | **Height + accent color** | Tiles rise as low slabs (~⅕ tile tall), accent-colored tops |
| Inputs | Stacking | Each pond is a thin sheet; focused sheet opaque, neighbors faint; edge label `n = 3` |

**Color rule:** everything the level fixes is grayscale. Only the learner's area uses accent color and height. Remaining colors are reserved: frog green, test-frog hue, and **red only for failures**. Exact palette is TBD.

**Why slabs:** a Preservation failure becomes a frog **falling off the edge**; editing the formula makes tiles **rise and sink** live; checkerboards and parabolas render as tidy geometry.

### 3.3 Characters and objects

| | Real frogs | Test frogs |
|---|---|---|
| Meaning | Actual runs of the program | Hypothetical states placed by the hand |
| Origin | **Hatch from eggs** | **Placed by the hand** |
| Color | Frog green | Same model, distinct hue |

**The hand** — small, round, minimal, mitten-like, same material as the world. Appears briefly to act, then leaves. Gestures:

| Gesture | Used for |
|---|---|
| Place | Sets a test frog on a chosen tile |
| Point | Highlights a failing egg/frog |
| Tap fingers | Waiting while the solver runs |
| Shrug | Undecided verdict |
| Scatter | Sprinkles frogs everywhere on success (frog rain) |

Frog and hand are **built procedurally from spheres and capsules** in v1 (no glTF pipeline).

### 3.4 Movement and interaction

- **One hop = one full loop iteration** (never per statement — the invariant only needs to hold at the loop head). Arc with a small landing squash.
- **Shared beat:** all running frogs hop on the same tick. Stopped frogs sit and blink.
- **Code link:** the loop header highlights each time frogs land; a selected frog's values appear under the code like a debugger (`x = 2, y = 4`).
- **Hover preview:** hovering a tile shows a translucent outline frog arcing to where a frog there would hop.

### 3.5 Check choreography

Every result follows one script: **camera glides (switching ponds if needed) → frog appears → event → highlight → one-line caption with concrete values → replay button.**

| Result | Choreography | Example caption |
|---|---|---|
| Init fails | Camera finds an egg on the floor; hand points; egg pulses red; frog hatches off the slab | *"This frog starts at i = 0, n = 1 — outside your area."* |
| Preservation fails | Hand places a test frog on a slab in the continue region; it hops and **falls off**; turns red | *"From (0, 2), one hop lands at (1, 2) — outside your area."* |
| Exit fails | Hand places a test frog on a slab in the stop region, on a tile with no goal marker; tile pulses red | *"A frog that stops at i = 1, n = 0 doesn't meet the postcondition."* |
| Undecided | Hand shrugs | *"No frog breaks this in ponds 0–200, tiles within ±500 — but I couldn't prove it either."* + level hint |
| All pass | Camera pulls back; hand **scatters frogs**; continue-region frogs hop and land on slabs; stop-region frogs sit on goals; in pond levels the rain sweeps the stack | — |

The checker splits the formula at top-level `&&` internally, so captions can name which conjunct broke: *"`(x + y) % 2 == 0` no longer holds after the hop."*

---

## 4. Formula language

The learner types the area into **one text box**. The formula language is the expression subset of the program language.

- **Operators:** `+ - * / %`, `== != < <= > >=`, `&& || !`, parentheses.
- **Built-ins:** `abs`, `min`, `max` (piecewise-linear; decidable).
- **Names:** only the level's loop variables and inputs.
- **Types:** `int` and `bool`, strictly checked.
- **Chained comparisons:** `0 <= i <= n` means `0 <= i && i <= n` (unambiguous because `bool <= int` is a type error).
- **Mathematical integers:** unbounded, no overflow.
- **`/` and `%` only by positive integer literals.** `%` is Euclidean (always in `0..k-1`, so `(-3) % 2 == 1`) and `/` is the matching floor division (`a == k*(a/k) + a%k`). This removes division by zero and keeps otherwise-linear formulas decidable. The UI explains the difference from C/JS in a tooltip.
- **`*` between variables is allowed** (needed for sum-style levels); it is the only source of "undecided".

### Live feedback

- Valid formula → slabs rise/sink (debounced).
- Syntax error or unfinished input → last valid slabs stay, dimmed; squiggle at the error.
- Friendly type errors: *"`x + y` is a number, but an area needs a true/false condition. Did you mean `x + y == 0`?"*
- **Checks run only when the learner presses Check** — never live.

---

## 5. Program language and level format

### 5.1 Program language (v1 scope)

A single loop; assignments and `if/else` in the body; no nested loops; no function calls.

| Statement | Meaning |
|---|---|
| `input n;` | Fixed input — **cannot be assigned**. Becomes a pond (or a plane axis via `view`). |
| `var i = n;` | Loop variable with an initial value. |
| `var x, y;` | Loop variables with no initial value — their starting values come from `requires`. |
| `requires …;` | Precondition. |
| `ensures …;` | Postcondition. |
| `while (…) { … }` | The single loop. |

**Eggs = every state satisfying `requires` after the initialization code runs.** This one rule covers single eggs per row (tutorial), egg regions (parity), and one egg per pond (sum).

### 5.2 Level file

Each level is a TypeScript module; the program is a string in our language.

```ts
export default defineLevel({
  id: 'countdown',
  title: 'Countdown',
  source: `
    input n;
    requires n >= 0;

    var i = n;
    while (i > 0) {
      i = i - 1;
    }

    ensures i == 0;
  `,
  view: { x: 'i', y: 'n' },           // layout only; leftover input → pond stack
  solutions: ['i >= 0', '0 <= i <= n'],
  pitfalls: [
    { formula: 'i <= n', message: 'That bound held in the tutorial — but which way does this frog move?' },
  ],
  hints: [
    'Frogs start at i = n and only move left.',
    'What stays true of i on every tile a real frog visits?',
  ],
});
```

- **`view`** maps two variables to the plane's axes; any remaining input gets the pond stack and vertical slider. Layout only — never semantics.
- **`solutions`** — known-good invariants; verified at build time; power the "equivalent to a known answer" fallback.
- **`pitfalls`** — expected wrong answers with tailored messages, shown when the learner's formula is Z3-equivalent to one (short timeout).
- **`hints`** — escalating hints.

### 5.3 Build-time validation (`scripts/validate-levels.ts`, runs in CI)

1. Parses and type-checks; no input is ever assigned.
2. Every `solution` is proved by Z3 within a time limit.
3. Every `pitfall` fails, and fails the rule it is expected to.
4. Near-miss rewrites of solutions (with/without division, reordered conjuncts) are decided, not undecided.
5. Starting states exist, and every real frog from a sampled starting state reaches the stop region within N steps (termination sanity check; termination itself is out of scope for learners).

---

## 6. The checker

### 6.1 Requirements

1. **Decide** all three rules over every pond and every tile (an infinite set).
2. On failure, return **one concrete frog**: rule, pond, tile, and its hop.
3. Prefer **nice** counterexamples: current pond first, then small absolute values, then nearest to the camera.

### 6.2 Approach: box search + Z3

1. **Box search** (fast, JS): enumerate a box around the camera (e.g. `|x|, |y| ≤ 20`, nearby ponds). Finds small, on-screen counterexamples for most wrong formulas in milliseconds.
2. **Z3** (authoritative, WebAssembly in a Web Worker, lazy-loaded): a check **passes only if Z3 proves it**. If the box finds nothing but Z3 finds a counterexample far away, the camera flies out to it — a live demonstration that "everything you could see looked fine" is not a proof.
3. **Small Z3 counterexamples:** query with growing bounds (`|vars| ≤ 4, 16, 64, …`, then unbounded); the first SAT is usually small.

Hosting needs cross-origin isolation headers (COOP/COEP) for Z3's WASM threads.

### 6.3 Verdicts

| Verdict | Hand | Level |
|---|---|---|
| Proved | Scatters frogs | Cleared |
| Counterexample | Places/points | Fix it |
| **Undecided** | Shrugs | **Not cleared** |

**Before reporting undecided:** try alternative Z3 strategies (nonlinear tactics); try proving the formula **equivalent to a known solution**; allow a longer budget (Check only). If still unknown: shrug, report what was searched, show a level hint (most commonly: *avoid division — write `2*s == i*(i+1)`*).

A large box search never silently substitutes for a proof — that would contradict what the site teaches.

### 6.4 One AST, three backends

The same parsed program/formula feeds:

| Backend | Purpose | Notes |
|---|---|---|
| JS interpreter (BigInt) | Frog animation, box search | Exact |
| SMT (Z3) | Proofs | Body is straight-line + `if`: preservation = substitute the new values (with `ite` for branches) |
| GLSL | Slab shader | 32-bit ints overflow far from origin — visual only, clamp/fade; Euclidean `%` implemented by hand |

Because animation and proof share one definition, they cannot disagree.

---

## 7. Screen layout and level flow

```
┌──────────────────────────────────────────────────────────┐
│  Level 1-2 · Parity                  ● Init ● Pres ● Exit │
│ ┌───────────────────┐                                  ▲  │
│ │ requires x >= 0 &&│                                  │  │
│ │  (x+y) % 2 == 0;  │        endless white plane       ●  │ ← pond slider
│ │ while (x > 0) {   │◀ highlights on landing            │  │   (vertical;
│ │   x = x - 1;      │                                  │  │   hidden on
│ │   y = y + 1;      │                                  ▼  │   one-plane
│ │ }                 │                                     │   levels)
│ │ ensures y%2 == 0; │                                     │
│ │ ── x = 2, y = 4 ──│◀ selected frog's values             │
│ └───────────────────┘                                     │
│   "A frog that stops at (-1, 1) doesn't meet the goal."   │
│ ┌──────────────────────────────────────────┐ ┌─────────┐  │
│ │ (x + y) % 2 == 0                          │ │  Check  │  │
│ └──────────────────────────────────────────┘ └─────────┘  │
│   ▶ Run   ⏸   ⏭ Step                         [?] Rules    │
└──────────────────────────────────────────────────────────┘
```

- 3D scene is full-screen; panels float over it.
- **Status lights** update only on Check; clicking a failed light replays its counterexample.
- **Caption bar** carries both tutorial text and counterexample explanations.
- **Rules card** button: the three-panel recap from the tutorial, always available.

**Level flow:** arrive (camera fly-in + caption) → watch (Run: eggs hatch, frogs hop) → write (slabs follow the formula) → Check (hand appears; all lights update; **first failure** in Init → Preservation → Exit order plays) → clear (frog rain → next level).

**Platform:** desktop first. Mobile, at most, view-only.

**Progress** is saved in the browser; the tutorial can be skipped and replayed.

---

## 8. Tutorial

A scripted, guided sequence — separate from levels, built on the same engine. Target length ≈ 10 minutes.

### 8.1 Principles

- **One program throughout:** a counter.
- **Progressive reveal:** start with a bare plane and one frog; the code panel, eggs, goals, formula box, and each light appear only when the story needs them. Lights for rules not yet introduced stay hidden.
- **Advance on conditions, not exact strings** (e.g. "Init light turned green").
- **Every rule's failure is witnessed once** — by the learner's own formula, or by a short *"what if you'd written…"* replay.
- **No ponds** in the tutorial.

### 8.2 Program and layout

```
// input n
requires n >= 0;
var i = 0;
while (i < n) {
  i = i + 1;
}
ensures i == n;
```

- Horizontal axis `i` — frogs **hop right**. Rows are `n`; rows with `n < 0` do not exist.
- Eggs: one per row at `i = 0`, a column fading into fog.
- Stop region: `i >= n` (gray triangle). Goal: the diagonal `i == n`.
- Running all frogs draws a **staircase** onto the diagonal.

### 8.3 Act 1 — The world

| # | Beat | Revealed |
|---|---|---|
| 1 | One frog at `i = 0, n = 3`. *"This frog is a program state."* | Frog, axis labels |
| 2 | Step: the body runs once; frog hops to `(1, 3)`. | Code panel, loop-header highlight, debugger values |
| 3 | Step until `i = 3`; the gray stop region appears; the frog sits. Hover to preview hops. | Stop region, hover preview |
| 4 | *"Where can frogs start?"* Eggs appear. | Eggs |
| 5 | *"What we want at the end."* Goal markers appear. Run: staircase. *"Looks correct!"* | Goals, Run |
| 6 | Camera pulls back and keeps going. Click eggs to run them; all work. *"Infinitely many — watching can't prove it for all."* | Zoom out |

### 8.4 Act 2 — The area, one rule at a time

| Attempt | Formula | Result | Teaches |
|---|---|---|---|
| **A** | `i == n` — "just write the goal" | ❌ Init: egg at `(0, 1)` is on the floor. **Hand's first appearance** (*"This hand checks your area. It will look for a frog that breaks it."*), points at the egg. | Rule 1 |
| **B** | `i == 0 \|\| i == n` — "start or done" | ✅ Init · ❌ Preservation: frog at `(0, 2)` hops to `(1, 2)` and falls off. | Rule 2: frogs pass through the tiles in between |
| **C** | `i >= 0` — "starts at 0, only moves right" | ✅ Init · ✅ Preservation → **"why" beat** (one frog, slab after slab) → ❌ Exit: hand places a frog at `i = 1, n = 0`. *"But i never passes n!"* → *"Your area doesn't say that."* | Rule 3 + the adversary |
| **D** | `0 <= i <= n` | ✅✅✅ Frog rain | Strengthening |

### 8.5 Guidance that fades

| Attempt | Guidance | UI |
|---|---|---|
| A | Exact formula | Ghost text; Tab accepts |
| B | The idea in words | Ghost text after a pause, or "Show me" |
| C | A hint | "Show me" only |
| D | Learner's own | Escalating hints → "Show me" |

### 8.6 Ending

Frog rain → **rules recap card** (egg on slab · hop slab-to-slab · stopped frog on goal) → Level 1-1.

---

## 9. Curriculum (v1)

### Ch 0 — Tutorial
The counter (§8).

### Ch 1 — One plane
*Practice the three rules alone. No ponds.*

| # | Program | Invariant | Lesson | Pitfall |
|---|---|---|---|---|
| 1-1 | **Countdown** — `input n; requires n >= 0; var i = n; while (i > 0) i = i - 1; ensures i == 0;` · view `(i, n)` | `i >= 0` | Mirror of the tutorial, unguided | `i <= n` (copied from tutorial) → ❌ Exit at `i = -1, n = 0`. *Don't pattern-match.* |
| 1-2 | **Parity** — `var x, y; requires x >= 0 && (x + y) % 2 == 0; while (x > 0) { x = x - 1; y = y + 1; } ensures y % 2 == 0;` | `x >= 0 && (x + y) % 2 == 0` | Egg region; diagonal hops; find what the hop preserves | `(x + y) % 2 == 0` → ❌ Exit at `(-1, 1)` |
| 1-3 | **Step by 2** — `input n; requires n >= 0 && n % 2 == 0; var i = 0; while (i < n) i = i + 2; ensures i == n;` · view `(i, n)` | `i <= n && i % 2 == 0` | **Strengthening for Preservation**; only even rows exist | `i <= n` → ❌ Preservation: test frog at `i = 1, n = 2` hops to `3` |

### Ch 2 — Stacked ponds
*Inputs become layers. The common shape: a preserved equation + a bound.*

| # | Program | Invariant | Lesson | Pitfall |
|---|---|---|---|---|
| 2-1 | **Doubling** — `x = 0; y = 0; while (x < n) { x = x + 1; y = y + 2; }` → `y == 2 * n` | `y == 2 * x && x <= n` | **Bridge:** tutorial grid rows lift into stacked layers; first pond level | `y == 2 * x` → ❌ Exit past `x = n` |
| 2-2 | **Transfer** — `x = n; y = 0; while (x > 0) { x = x - 1; y = y + 1; }` → `y == n` | `x + y == n && x >= 0` | Conserved quantity involving the input | `x + y == n` → ❌ Exit at `x = -1` |
| 2-3 | **Division by 3** — `q = 0; r = a; while (r >= 3) { r = r - 3; q = q + 1; }` → `a == 3 * q + r && 0 <= r < 3` | `a == 3 * q + r && r >= 0` | A real algorithm; post ≈ invariant | `a == 3 * q + r` → ❌ Exit at negative `r` |
| 2-4 | **Sum 1..n** — `i = 0; s = 0; while (i < n) { i = i + 1; s = s + i; }` → `2 * s == n * (n + 1)` | `2 * s == i * (i + 1) && i <= n` | Multiplication; division-free style; possible undecided | `2 * s == i * (i + 1)` → ❌ Exit |

### Ch 3 — Branches
*With `if` in the body, the hop depends on the tile; Preservation must hold for every branch.*

| # | Program | Invariant | Lesson | Pitfall |
|---|---|---|---|---|
| 3-1 | **Absolute value by walking** — `input a; var x = a; var y = 0; while (x != 0) { if (x > 0) { x = x - 1; } else { x = x + 1; } y = y + 1; } ensures y == abs(a);` | `y + abs(x) == abs(a)` | Positive-`x` frogs hop left, negative-`x` frogs hop right; ponds for negative `a` exist; stop region is a single line | `y == a - x` → ✅ for the `x > 0` branch, ❌ Preservation for any frog taking the `else` branch (e.g. `a = 0, x = -1, y = 1`) |
| 3-2 | **Even Out** — `var x, y; requires x >= 0 && y >= 0; while (x != y) { if (x > y) { x = x - 1; } else { y = y - 1; } } ensures x == y && x >= 0;` | `x >= 0 && y >= 0` | Keeping one variable in range needs a fact about the other | `x >= 0` → ❌ Preservation: a test frog at `x = 0, y = -1` steps `x` to `-1` |

### v2 (postponed)

- **Ch 4 — Arrays as pond labels:** linear search, max, binary search. Needs `a[i]` and bounded `forall` in the formula language.
- **Ch 5 — Beyond the grid:** programs that mutate arrays (sorting, partitioning); state cards replace the grid while frogs, slabs, and the hand stay.

---

## 10. Tech stack and architecture

| Concern | Choice |
|---|---|
| Build | Vite + TypeScript |
| UI | React |
| 3D | react-three-fiber + drei |
| Camera | drei `CameraControls` (animated transitions between ponds) |
| Choreography | GSAP timelines |
| State | zustand (shared by scene and UI) |
| Editor | CodeMirror 6 with a Lezer grammar |
| Solver | z3-solver (WASM) in a Web Worker |
| Hosting | Static host with COOP/COEP headers |

**Area rendering:** the formula is compiled to GLSL and evaluated per tile on the GPU, so the plane is genuinely unbounded. Frogs, eggs, goal markers, and the hand are ordinary meshes.

```
src/
  lang/        Lezer grammar (program + formula), type checker, AST,
               interpreter (BigInt), → SMT, → GLSL
  checker/     box search, Z3 Web Worker, counterexample ranking,
               verdicts + undecided fallbacks
  levels/      defineLevel() + one file per level
  scene/       Plane, Slabs, Egg, GoalMarker, Frog, Hand, PondStack, CameraRig
  choreo/      GSAP timelines: replays, frog rain, bridge cinematic
  tutorial/    step-based script engine
  ui/          code panel, formula box, lights, caption bar, pond slider
  store/       zustand store
scripts/
  validate-levels.ts
```

---

## 11. Build plan

### Spikes (riskiest first)

- **S1 — Z3 in the browser:** z3-solver in a Worker on the real hosting setup (COOP/COEP); measure Sum-level check time.
- **S2 — Formula → shader slabs:** render `2*s == i*(i+1) && i <= n` as slabs; zoom far out; confirm overflow handling.

### Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Skeleton | White plane, fog, grid shader, camera |
| M1 | Language core | Grammar, type checker, interpreter, unit tests; levels load |
| M2 | Scene core | Parity level visible: regions, goals, eggs, live slabs, frogs on the beat, hover preview |
| M3 | Checker | Box search + Z3 worker + verdicts; `validate-levels` in CI |
| M4 | Hand & choreography | Three replays, shrug, frog rain, lights, captions |
| M5 | Ponds | Stack, slider, camera glide, pond-switching counterexamples, bridge cinematic |
| M6 | Tutorial | Full counter tutorial with fading guidance |
| M7 | Content & polish | All v1 levels, pitfalls, hints, recap card, progress saving, playtesting |

**Parity (1-2)** is the testbed level for M2–M4.

---

## 12. Out of scope (v1) and open questions

**Out of scope:** termination / loop variants; nested loops; function calls; levels with more than one input; arrays; mobile editing.

**Open:**

- Hover-to-highlight a conjunct's region inside the single text box — interaction details.
- Domain name.

---

## 13. Implementation notes (v1)

Where the build differs from the plan above, and why:

| Plan | Implemented | Why |
|---|---|---|
| Lezer grammar for programs and formulas | Hand-written recursive-descent parser (`src/lang/parser.ts`); CodeMirror uses a small `StreamLanguage` for highlighting | Precise, friendly error messages with spans; one parser feeds the interpreter, Z3, and rendering |
| Formula → GLSL slabs | Formula compiled to a fast JS function, evaluated over a tile window that follows the camera (size grows with zoom); instanced meshes with a per-instance height attribute | Exact integer semantics everywhere, no shader overflow; a window of up to 141×141 tiles plus fog reads as endless |
| Z3 in our own Web Worker | Z3's async API on the main thread | z3-solver already runs `check()` on Emscripten worker threads; the page stays responsive |
| Spikes S1/S2 | Skipped | Verified during implementation: Z3 runs in the browser (dev and production builds) and every level's solution is proved in < 100 ms in Node |

**Palette:** tiles `#fbfbfa` on background `#e9ebef` (gaps read as grid lines); stop tiles `#d9dce2`; area slabs `#7fb2f0` (stop-region slabs `#a3b7cf`, so the stop region stays readable on top of the area); real frogs `#5fbf4a`; test frogs `#b48cf0`; failures `#ef4f4f`.

**Counterexample ranking (box search):** nearest pond first, then smallest `|x| + |y|`, then closest to the camera. Z3 counterexamples come from growing bounds (±8, ±64, ±1024, then unbounded, then `QF_NIA`).
