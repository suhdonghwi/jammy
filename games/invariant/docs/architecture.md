# Invariant Frog — Architecture

How the code is organised, and the rules that keep it working. For what the
game is, see [design.md](design.md); for how it should feel, see
[experience.md](experience.md).

Stack: Vite, React, TypeScript, react-three-fiber (three.js) with drei,
zustand, GSAP, Tailwind CSS v4, z3-solver (WebAssembly). The area box is a
plain textarea over a coloured copy of its text; the 3D title's letter
outlines are read from the font at build time (`scripts/title-glyphs.ts`); the
Korean fonts are subsets made by `pnpm fonts`.

## Layout

```
src/
  main.tsx, App.tsx   entry point and the page's top-level layout
  lang/        parser, type checker, AST, interpreter, symbolic body execution
  checker/     box search (nice counterexamples) + Z3 (proofs), verdicts
  levels/      the level format (level.ts), every level (catalog.ts) and its Korean text (catalog.ko.ts), the plane's tiles (tiles.ts)
  i18n/        the language switch, and every other line the game says, in English (en.ts) and Korean (ko.ts)
  game/        the zustand store, and what the app's buttons do (actions.ts)
  director/    scripted sequences: the hand, Step/Run, check playback
  tutorial/    the tutorial's steps, and the beat/caption helpers they are written with
  audio/       the sound effects
  hooks/       React hooks the scene and the DOM share: exit animations, media queries
  scene/       the 3D world
    floor/       the infinite floor, drawn per pixel from the level's formulas (formulas → GLSL)
    area/        the learner's slabs, eggs and goal columns
    frogs/       frog state, motion, rendering, hatching
    hand/        the pointing hand that brings ghost frogs
    labels/      tags over tiles and frogs (callouts, failures, frog values)
    level/       a level's scene and hover preview
    home/        the home screen's scene
    shaders/     shared GLSL
  ui/          the DOM over the scene
    hud/         level screen: top bar, code panel, inputs card, caption, formula box, controls
    home/        title (3D lettering), home copy, level list
    rules/       the rules and syntax cards
    dev/         the link preview's page (`?poster`, development only)
  styles.css   Tailwind setup: design tokens, keyframes, the page, the spotlight
scripts/       level validation, the Z3 copy, font subsets, the title's glyphs, the link preview image
tests/         unit tests (language, box search)
```

Dependencies point downward: `lang` knows nothing of levels; `levels` and
`checker` know nothing of the UI; `scene` and `ui` render state; `director`,
`tutorial` and `game/actions` drive it.

## One language, three backends

A level's program and the learner's formula are parsed once into one AST, which
feeds:

- an **exact interpreter** (BigInt) for frog hops, eggs and the box search;
- **fast float functions** for building thousands of tiles per frame;
- **Z3** for proofs: an array input is an uninterpreted function from index
  to value (read as 0 outside its length), `forall`/`exists` are Z3's own
  quantifiers. A bounded search (small values first, for small
  counterexamples) unrolls the quantifiers into a quantifier-free query and
  checks any model exactly before trusting it; the unbounded pass, which
  proves, keeps the quantifiers. Z3's WebAssembly build has crashed on
  quantified *model finding* under a timeout, so bounded passes never send it
  a quantifier;
- **GLSL**, compiled into the floor shader (32-bit ints: visual only). An
  integer input is a uniform, an array input a uniform `int[MAX_LEN]` with
  its length's uniform; a quantifier becomes a function with a loop that
  stops after MAX_LEN + 1 steps. The inputs' part of the precondition is the
  same for every tile, so it is one uniform set from the CPU.

Change semantics (operators, division, types) in `lang/` and make every backend
agree. `pnpm validate` and the tests are the safety net.

## State

- **The store** (`game/store.ts`, zustand) holds what the UI and the sequences
  share: mode, level, the plane in view (`inputs`: the off-axis inputs'
  values, with `planeKey` naming it for frogs and effects), formula, verdicts,
  caption, reveal flags, tutorial state.
  Components read it with selectors; other code reads `useGame.getState()` and
  writes `useGame.setState()`. Store actions exist only where there is logic
  (opening a level, compiling a formula).
- **Per-frame scene data lives outside the store**, in plain module objects read
  in `useFrame`: the frogs (`frogWorld`), slab heights (`field`), the hand's
  pose (`handState`), tile occupancy, goal ripples, the hovered tile. Never put
  per-frame data in zustand.
- **Slab height has one source**: `field`. Slabs animate on the GPU from
  `(from, to, t0)`, and `field.heightAt` gives the same height on the CPU, so
  anything standing on the floor (frogs, eggs, tags, the hand's shadow) uses it.

## Time

- **Everything in the scene runs on scene time** (`scene/sceneTime.ts`):
  `sceneNow()` for timestamps and shader uniforms, `after()` / `sleep()` for
  waits. Scene time stops while the page is hidden, so the scene pauses instead
  of jumping ahead. Don't use `performance.now()` or `setTimeout` for anything
  that animates in the scene.
- **UI timing is real time** and matched to its CSS (exits last `EXIT_MS`).

## Sequences

- Anything scripted — the hand's demonstrations, Run, frog rain — is a
  `director/` function. Each starts with `begin()`, which
  cancels whatever was playing; after every `await` it checks `tok.alive` and
  stops if it was superseded. `busy` locks the learner's input while one plays.
- **Tutorial steps declare the scene they start from** (reveal flags, frogs,
  formula, camera), so Back and skip-ahead can rebuild any step instantly. A
  step runs under a generation number and calls `guard(gen)` after every
  `await`, inside a beat's `prepare` too (a fast Next skips ahead while a
  camera glide is still playing, and whatever the old step does after that
  glide would land on the new step); stopping or rewinding the tutorial aborts
  the old generation.
- The tutorial reacts to the learner through events (`stepped`, `runDone`),
  through Check and through caption buttons; it never polls.
- **A stage accepts any formula.** `stage()` in `tutorial/script.ts` waits for
  Check, runs the rules introduced so far, acts out the first failing rule and
  waits again; it returns on the first pass. `demo()` has the hand type a
  pitfall formula and act out its failure, then restores the learner's area.
  Steps after the formula box opens declare `formula: 'learner'`: the area the
  learner last had pass a stage, kept in `tutorial/steps.ts` so Back restores
  it. A rule the learner saw fail on their own area is remembered there too,
  and the hand's demo of that rule is skipped.
- **Playtesting:** `?step=N` on the URL starts the tutorial at step N (the
  index in `STEPS`), with an empty area.

## Rendering

- The floor is **one shader plane**: the level's precondition, guard and
  postcondition are evaluated per pixel, so the plane is truly infinite.
- Slabs, eggs, goal columns, frogs and hatching shells are **instanced**; only
  the tiles near the camera are built, in a window that moves in steps.
- Shadows are soft blobs, not shadow maps. Models are procedural (the only assets
  are the bundled fonts and sound clips).

## Styling

- Components style themselves with **Tailwind classes**. `src/styles.css` holds
  only what is clearer as CSS: the design tokens (`@theme`), keyframes, the page
  base, and the tutorial's spotlight ring.
- Class lists used in many places live in `ui/classes.ts`: cards, card labels,
  and `button(variant, size)`. Variants are complete and never override each
  other — don't append utilities that conflict with a variant's.
- Use the theme's tokens (colours, `text-md`, shadows, animations) and
  Tailwind's scales before arbitrary values.

## The solver

Z3 runs as WebAssembly with threads, so the page must be **cross-origin
isolated**: every host must send `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Its browser build is copied into
`public/z3/` by `pnpm dev` and `pnpm build`, and loaded lazily: it is warmed up once the player
opens the level list or a level, never on the home screen alone.

## Conventions

- Components are `PascalCase.tsx`, other modules `camelCase.ts`; one focused
  concern per file — split a file when it grows several.
- Each module opens with a short comment saying what it is for; comments say
  *why*, not what.
- Imports: packages first, then local modules, each alphabetical by path.
- Remove dead code rather than leaving it behind.
- Before committing: `pnpm typecheck`, `pnpm test`, `pnpm validate` (when
  levels, the language or the checker changed), `pnpm build`.
- In development, `window.__game`, `__open(id)`, `__check()`, `__frogs`,
  `__hand` and `__rig` are available in the console.
