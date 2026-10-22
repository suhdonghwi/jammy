# Invariant Frog — Architecture

How the code is organised, and the rules that keep it working. For what the
game is, see [design.md](design.md); for how it should feel, see
[experience.md](experience.md).

Stack: Vite, React (with React Compiler), TypeScript, react-three-fiber
(three.js) with drei, zustand, Tailwind CSS v4, z3-solver (WebAssembly),
lucide-react, Vercel Web Analytics, Vitest. The area box is a plain textarea
over a coloured copy of its text. The 3D title's letter outlines are read
from the font, and spaced, at build time (`scripts/title-glyphs.ts`,
`ui/home/title/layout.ts`); the Korean fonts are subsets made by `pnpm fonts`.

## Layout

```
src/
  main.tsx, App.tsx   entry point and the page's top-level layout
  lang/        parser, type checker, AST, interpreter, symbolic body execution
  checker/     box search (nice counterexamples), Z3 (proofs) and its loaders and dec_ref guard, verdicts
  levels/      the level format (level.ts), every level (catalog.ts), its Korean text (catalog.ko.ts, localize.ts), the plane's tiles
  i18n/        the language switch, and every other line the game says (en.ts, ko.ts)
  game/        the zustand store, cleared levels (progress.ts), what the app's buttons do (actions.ts)
  director/    scripted sequences: Step/Run, looping frogs, ghost frogs, check playback
  tutorial/    the tutorial's steps, and the beat/caption helpers they are written with
  audio/       sound clips and the synthesised ghost siren
  hooks/       React hooks the scene and the DOM share: exit animations, media queries
  storage.ts   localStorage behind a try/catch: language, mute, cleared levels, code panel width
  scene/       the 3D world: canvas, camera rig, scene time, hovered tile, WebGL check
    floor/       the infinite floor, drawn per pixel from the level's formulas (GLSL)
    area/        the learner's slabs, eggs and goal columns
    frogs/       frog state, motion, rendering, hatching
    labels/      tags over tiles and frogs, and outlines of endless regions
    level/       a level's scene and hover preview
    home/        the home screen's scene
    shaders/     shared GLSL
  ui/          the DOM over the scene; shared dialogs, caption Markdown, syntax colours, RevealSlot, error cards
    hud/         level screen: top bar, code panel, inputs, caption, formula box, rule lights, tile readout, controls
    home/        title (3D lettering), home copy and level list, corner buttons, language switch
    rules/       the rules and syntax cards
    dev/         the link preview's page (`?poster`, development only)
    timing.ts    EXIT_MS, the length of every exit animation
  styles.css   Tailwind setup and the little that is clearer as CSS (see Styling)
scripts/       level validation, the Z3 copy, font subsets, the title's glyphs, the link preview image
tests/         unit tests (language, box search)
```

Dependencies point downward: `lang` knows nothing of levels (it uses `i18n`
only for error messages); `levels` and `checker` know nothing of the UI;
`scene` and `ui` render state; `director`, `tutorial` and `game/actions`
drive it.

## One language, three backends

A level's program and the learner's formula are parsed once into one AST,
which feeds:

- an **exact interpreter** (BigInt) for frog hops, eggs, and confirming what
  the box search found;
- **fast float functions** for building thousands of tiles at once and for
  the box search's scan;
- **Z3** for proofs: an array input is an uninterpreted function from index
  to value (0 outside its length), `forall`/`exists` are Z3's own
  quantifiers. Bounded passes (small values first, for small
  counterexamples) unroll the quantifiers into a quantifier-free query,
  skipping a bound whose unrolling would be too large, and check any model
  exactly before trusting it; the unbounded pass, which proves, keeps the
  quantifiers. Z3's WebAssembly build has crashed on quantified *model
  finding* under a timeout, so bounded passes never send it a quantifier;
- **GLSL** for the floor shader (32-bit ints: visual only), from the level's
  formulas only; the area is drawn as slabs. An integer input is a uniform,
  an array input a uniform `int[MAX_LEN]` with its length's uniform; a
  quantifier becomes a loop of at most MAX_LEN + 1 steps. The inputs' part of
  the precondition is the same for every tile, so it is one uniform set from
  the CPU.

The interpreter and the float functions share one iteration budget per
evaluation across a formula's quantifiers (`EVAL_BUDGET`): past it the exact
interpreter throws `OverBudget`, which the checker treats as "can't confirm"
(the rule goes on to Z3), and a float function returns `NaN`, which reads as
false. They never throw while rendering. The type checker refuses constant
ranges wider than 1000 values up front.

Change semantics (operators, division, types) in `lang/` and make every
backend agree. `pnpm validate` and the tests are the safety net.

## State

- **The store** (`game/store.ts`, zustand) holds what the UI and the
  sequences share: mode, level, the plane in view (`inputs`, the off-axis
  inputs' values; `planeKey(inputs)` names it), formula, verdicts, caption,
  reveal flags, and the tutorial's own state under `tutorial`. Components
  read it with selectors; other code uses `useGame.getState()` and
  `useGame.setState()`. Store actions exist only where there is logic
  (opening a level, compiling a formula). Small separate stores hold cleared
  levels (`useProgress`), the language (`useLang`), mute (`useSound`) and
  the hovered tile (`useHover`).
- **Per-frame scene data lives outside the store**, in plain module objects
  read in `useFrame`: the frogs (`frogWorld`), slab heights (`field`),
  hatching shells and slab chips, tile occupancy, goal ripples. Never put
  per-frame data in zustand.
- **Slab height has one source**: `field`. Slabs and eggs animate on the GPU
  from `(from, to, t0)`, and `field.heightAt` gives the same height on the
  CPU for everything else standing on the floor (frogs, tags, chips).

## Time

- **Everything in the scene runs on scene time** (`scene/sceneTime.ts`):
  `sceneNow()` for timestamps and shader uniforms, `after()` / `sleep()` for
  waits. Scene time stops while the page is hidden. Don't use
  `performance.now()` or `setTimeout` for anything that animates in the
  scene.
- **Each screen comes in on its own, together**: scene time holds, and
  `styles.css` pauses every CSS animation, until the screen's first frame is
  drawn and the fonts are in (`startScene`; after 3 s it starts anyway).
  Entrances then play in order: the world fades in, then the copy from the
  top down (staggered with `animation-delay`). Time new entrances from that
  moment, not from mounting. `switchScene` (opening a level, the tutorial or
  the menu) fades the current screen out and starts over the same way;
  nothing, the camera included, carries over. Slow one-off work belongs in
  that wait (the title's geometry is built once and kept; the audio context
  is made before the first press, and sleeps while muted or hidden). Before
  the first start, `index.html`'s backdrop and loader cover the page;
  `startScene` fades them out.
- **UI timing is real time** and matched to its CSS (exits last `EXIT_MS`).

## Sequences

- Anything scripted — counterexamples, Run, the ghost wave, looping frogs —
  is a `director/` function. Each starts with `begin()`, which cancels
  whatever was playing; after every `await` it checks `tok.alive` and stops
  if it was superseded. `busy` locks the learner's input while one plays.
- **A check can't be stopped, only abandoned.** `runChecker` takes its own
  token (`beginCheck()`); `interrupt()` (a new level, the menu, a tutorial
  rewind) abandons it, and a result for another level, mode or formula is
  dropped. `checking` stays set until every solver call has settled, so
  Check stays disabled across screens; Z3's queued `dec_ref`s are flushed
  only while no solver call is running (`z3-guard.ts`). The area box is
  read-only while `busy` or `checking`, so what gets cleared is what was
  checked.
- **The camera moves through one call.** `cameraRig.frame({ at, focus })`
  takes the tiles a moment is about (`focus`, plus `labels` for tiles that
  carry a tag) and, optionally, a preferred view (`at`), and fits them into
  the screen left free by every element marked `data-frame` (top bar, code
  panel, caption column). With `at` it always goes there, zoomed out and
  shifted only as far as the tiles need; without it, it moves only when the
  tiles don't fit. Tutorial steps, counterexamples, Run and a level's start
  all frame this way; don't call `moveTo`/`dollyTo` directly. The other
  entries are narrow: `include(labels)` (callouts), `zoomTo` (the proof's
  wide view), `resetAngle`; the home screen drives its own camera.
  A move waits until the panels have been still for `SETTLE_MS`, so it is
  measured against the new caption, and requests made meanwhile merge; the
  last shot is re-fitted (without its `at`) when the panels settle at a new
  size. Before a screen shows, placements snap; after, they glide. Use
  `arrive()` when something should start as the camera gets there (a hatch,
  a counterexample's frog) rather than after it comes to rest.
- **Tutorial steps declare the scene they start from** (reveal flags, frogs,
  formula) and the view they show (`camera`, `focus`, `labels`; default
  `VIEW`), so Back and skip-ahead can rebuild any step instantly and frame
  its view. Steps don't move the camera themselves, except through a played
  proof (the wrap-up). A step runs under a generation number and calls
  `guard(gen)` after every `await`, inside a beat's `prepare` too (a fast
  Next can skip ahead mid-glide, and what the old step does after it would
  land on the new step); stopping or rewinding aborts the old generation.
- The tutorial reacts to the learner through events (`stepped`, `runDone`),
  Check and caption buttons; it never polls.
- **A stage accepts any formula.** `stage()` in `tutorial/script.ts` waits
  for Check, runs the rules introduced so far, acts out the first failing
  rule and waits again; it returns on the first pass. `demo()` types a
  pitfall into the area box, acts out its failure, then restores the
  learner's area. Steps after the formula box opens declare `formula:
  'learner'`: the area the learner last had pass a stage, kept in
  `tutorial/steps.ts` so Back restores it, along with the rules they saw
  fail (whose demos are skipped).
- **Two levels, one story.** A step's scene says whether it is on the
  example; stepping forward onto the other level fades the screen
  (`switchScene`), Back and skip-ahead rebuild it at once.
- **Playtesting:** `?step=N` on the URL starts the tutorial at step N (the
  index in `STEPS`) with an empty area, in any build.

## Rendering

- The floor is **one shader plane**: the level's precondition, guard and
  postcondition are evaluated per pixel, so the plane is truly infinite.
- Slabs, eggs, goal columns, frogs and hatching shells are **instanced**;
  only the tiles near the camera are built, in a window that moves in steps.
- **Errors don't take the page down**: the WebGL 2 check (`scene/webgl.ts`),
  the error boundary around the game (`ui/ErrorBoundary.tsx`) and the 3D
  title's own boundary fall back to `ui/Trouble.tsx` or plain text.
- Shadows are soft blobs, not shadow maps. Models are procedural (the only
  assets are the bundled fonts and sound clips).

## Styling

- Components style themselves with **Tailwind classes**. `src/styles.css`
  holds only what is clearer as CSS: the design tokens (`@theme`), the
  `narrow`, `short` and `compact` variants (twins of `hooks/media.ts`), the
  Korean `@font-face`s, keyframes, the page base, the screen start/leave
  rules, and the tutorial's spotlight.
- Class lists used in many places live in `ui/classes.ts`: `CARD`,
  `CARD_LABEL`, and `button(variant, size)`. Variants are complete and never
  override each other — don't append utilities that conflict with a
  variant's.
- Use the theme's tokens (colours, `text-md`, shadows, animations) and
  Tailwind's scales before arbitrary values.

## The solver

Z3 runs as WebAssembly with threads, so the page must be **cross-origin
isolated** (`Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`); loading fails fast otherwise,
and can be retried. `pnpm dev` and `pnpm build` copy its browser build into
`public/z3/<version>/`, versioned so hosts can cache it forever (the copy
leaves the current version in place, so a running dev server keeps serving
it). It is loaded as a plain script, not bundled, because its thread workers
re-load it by URL, and warmed up once the player opens the level list, a
level or the tutorial, never on the home screen alone.

## Deployment

jammy.fun is one Vercel project built from the repository root: the root
`pnpm build` builds the game with `BASE_PATH=/invariant/` into
`dist/invariant/`, beside the hub's pages. The root `vercel.json` sends the
solver's headers under `/invariant/`, caches `assets/` and `z3/` forever,
and redirects every other path to the hub. Analytics report through
`/ribbit/`, rewritten to Vercel's insights endpoint, because ad blockers
list the default path.

## Conventions

- Components are `PascalCase.tsx`, other modules `camelCase.ts`; one focused
  concern per file — split a file when it grows several.
- No comments, except where code is otherwise nearly impossible to
  understand (see AGENTS.md).
- Imports: packages first, then local modules, each alphabetical by path.
- Remove dead code rather than leaving it behind.
- Before committing: `pnpm typecheck`, `pnpm test`, `pnpm validate` (when
  levels, the language or the checker changed), `pnpm build`.
- In development, `window.__game`, `__open(id)`, `__check()`, `__frogs` and
  `__rig` are available in the console.
