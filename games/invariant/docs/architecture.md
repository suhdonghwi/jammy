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
  lang/        parser, type checker, AST, interpreter, symbolic body execution, quantifier unrolling
  checker/     counterexamples on the plane in view (nearby.ts), Z3 (proofs) and its loaders and dec_ref guard, verdicts
  levels/      the level format (level.ts), the inputs that pick a plane (inputs.ts), every level (catalog.ts), its Korean text (catalog.ko.ts, localize.ts), the plane's tiles
  i18n/        the language switch, and every other line the game says (en.ts, ko.ts)
  game/        the zustand store, cleared levels (progress.ts), what the app's buttons do (actions.ts)
  director/    scripted sequences and the scopes that cancel them (sequence.ts); frogs, the player's Step/Run/egg controls, resets;
               solver runs, counterexamples, rule-by-rule verification, ghost frogs and the proof wave; a hop's sound and code cursor
  tutorial/    the tutorial's steps, and the beat/caption helpers they are written with
  audio/       sound clips and the synthesised ghost siren
  hooks/       React hooks the scene and the DOM share: exit animations, media queries
  storage.ts   localStorage behind a try/catch: language, mute, cleared levels, code panel width
  motion.ts    the motion tokens: every duration and pause (`--duration-*` in styles.css), EXIT_MS
  scene/       the 3D world: canvas, camera rig, scene time, hovered tile, WebGL check, the figure page's clip
    floor/       the infinite floor, drawn per pixel from the level's formulas (GLSL)
    area/        the learner's slabs, eggs and goal columns
    frogs/       frog state, motion, rendering, hatching, the real frog's trail
    labels/      tags over tiles and frogs, and outlines of endless regions
    level/       a level's scene and hover preview
    home/        the home screen's scene
    shaders/     shared GLSL: lighting and stripes, axis labels, goal pools and ripples, the horizon fade
  ui/          the DOM over the scene; shared dialogs, caption Markdown, syntax colours, RevealSlot, error cards
    hud/         level screen: top bar, code panel, inputs, caption, formula box, rule lights, tile readout, controls
    home/        title (3D lettering), home copy and level list, corner buttons, language switch
    rules/       the rules and syntax cards
    dev/         the link preview's page (`?poster`) and the paper's figures (`?figure=<name>`: the tutorial's states, and guesses at Overshoot's invariant), development only
  styles.css   Tailwind setup and the little that is clearer as CSS (see Styling)
scripts/       level validation, the Z3 copy, font subsets, the title's glyphs, the link preview image
tests/         unit tests (language, counterexample search)
```

Dependencies point downward: `lang` knows nothing of levels (it uses `i18n`
only for error messages); `levels` and `checker` know nothing of the UI;
`scene` and `ui` render state; `director`, `tutorial` and `game/actions`
drive it.

## One language, three backends

A level's program and the learner's formula are parsed once into one AST,
which feeds:

- an **exact interpreter** (BigInt) for frog hops, eggs, and confirming what
  Z3 found;
- **fast float functions** for building thousands of tiles at once;
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
(the tile is skipped and the rule goes on to Z3), and a float function returns `NaN`, which reads as
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
  hatching shells, tile occupancy, goal ripples. Never put
  per-frame data in zustand.
- **Slab height has one source: the area's formula.** Nothing lists the
  tiles of the area. On the GPU, `areaMask` (`scene/area/mask.ts`) evaluates
  the area over the window around the camera into a small texture, one texel
  per tile: on it now, on it before the last change, stop, goal, egg. It is
  redrawn only when the formula, the inputs or the window change. Slabs,
  eggs, goal columns and outlines read their tile's texel in the vertex
  shader, and rise or sink as one uniform blends "before" into "now". On the
  CPU, `field.heightAt` evaluates the same two formulas for whatever else
  stands on the floor (frogs, tags, trails, picking).

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
- **UI timing is real time** and matched to its CSS (exits last `EXIT_MS`,
  the CSS's `--duration-exit`).
- **Every duration and pause is a token** from `motion.ts`: `MICRO`, `SHORT`,
  `EXIT`, `BASE`, `LONG` for how long something moves, `TICK`, `BEAT`, `HOLD`
  for the gaps between moves (`ms()` turns one into a `sleep`). The CSS
  mirrors them as `--duration-*`. A new wait picks the token for what it is
  for, not a number that felt right; only accent animations (hatching, a
  cheer, a ghost's rise) keep their own lengths. Values that settle towards a
  target over time use `Toward` (`scene/easing.ts`), a timed smootherstep,
  not a per-frame exponential.

## Sequences

- Anything scripted — counterexamples, Run, the ghost wave, looping frogs —
  is a `director/` function. Each starts with `begin()`, which cancels
  whatever was playing; after every `await` it checks `tok.alive` and stops
  if it was superseded. `busy` locks the learner's input while one plays
  (`busyWhile(body)`). Sequences, checks and tutorial generations are
  three scopes made by `createScope()` (`sequence.ts`).
- **A check can't be stopped, only abandoned.** `runChecker` takes its own
  token (`beginCheck()`); `interrupt()` (a new level, the menu, a tutorial
  rewind) abandons it, and a result for another level, mode or formula is
  dropped. `checking` stays set until every solver call has settled, so
  Check stays disabled across screens; Z3's queued `dec_ref`s are flushed
  only while no solver call is running (`z3-guard.ts`). The area box is
  read-only while `busy` or `checking`, so what gets cleared is what was
  checked.
- **The camera follows one rule.** A moment names only what must be
  seen: `cameraRig.frame({ focus, labels })`, the tiles it is about plus the
  tiles that carry a tag. Nothing names a position or a zoom; a level's
  opening names a box of tiles (`frame`), a tutorial step its `focus`
  (default the tutorial board). The camera keeps one angle, and its pose is
  the closest one (from `MIN_DISTANCE` out to `MAX_DISTANCE`) that fits
  those tiles, centred, into the free screen: the part of the visible
  screen (it ends at `innerHeight`; the canvas is `h-lvh`, so on iOS Safari
  its bottom sits behind the toolbar) that no `data-frame` element covers.
  Of the free rectangles it takes the one where the tiles come out largest
  for their shape, not the largest by area, so a tall strip beside a panel
  doesn't win over a wide one under it. On phones the code panel is
  `data-frame="soft"`: tiles may pass under it, tags may not. The camera
  moves only when the tiles leave the free screen, a tag is under a soft
  panel, or it is more than `TOO_FAR` times further out than the fit; a
  move fits into the free screen inset by `MARGIN`, so a panel that grows
  a little doesn't move it again. Tutorial steps, callouts, counterexamples,
  Run, a level's start and the home screen all frame this way; don't call
  `moveTo`/`dollyTo` directly. The other entries are narrow: `zoomTo` (the
  proof's wide view), `resetAngle`, and `fitInto`, which the home screen
  uses each frame for its ring at its own lower angle. A move waits a few
  frames (`LAYOUT_BEAT_MS`) so a new caption is laid out, and, if the
  panels moved, until they have been still for `SETTLE_MS`; requests made
  meanwhile merge. Before a screen shows, placements snap; after, they fly.
  The rig holds the shot it was given until the player does anything (a
  tap or click anywhere, a drag, the wheel): while it holds one, the shot
  is checked again whenever the panels settle at a new size, so a caption
  the game brings in or a panel the tutorial opens can't cover it; once the
  player acts, the view is theirs, and folding the code panel, resizing it
  or opening the keyboard moves nothing until the game shows something
  new. While a text field has focus on a touch screen, the free screen is
  the one from just before (`followKeyboard`), so a shot the game shows
  meanwhile is fitted as if the keyboard were closed.
- **A camera move is a planned flight** (`scene/flight.ts`), not
  camera-controls' smoothing, which takes the same time for any distance
  (so far moves were fast) and starts with its hardest acceleration. A
  flight's length grows with the log of the trip (screens panned, zoom
  doublings, turn) from `FLIGHT_MIN` to `FLIGHT_MAX`, it eases with
  smootherstep (no jolt at either end), and on trips over about a screen it
  pulls back on the way, high enough that about two and a half screens show
  at its peak (up to `HIGHEST`), so the ground crosses the screen at a
  similar speed however far the trip. A
  new move mid-flight starts from where the camera is with the speed it has
  (quintic Hermite), so it bends rather than kinks. Position, zoom and angle
  share one flight (`opening` turns and moves at once). The player's drag or
  wheel stops a flight. camera-controls' own smoothing is left for the
  player's moves. `arrive()` resolves `ARRIVE_LEAD` before the flight lands,
  so a counterexample's frog sets off as the camera gets there. Fitting
  starts from the tiles' middle, so a far target behind the view is still
  reached.
- **A counterexample on another board waits for the learner**
  (`offerOtherBoard` in `director/counterexample.ts`): the check ends on a
  caption whose button plays it, and only then are the inputs changed.
- **Tutorial steps declare the scene they start from** (reveal flags, frogs,
  formula) and what they show (`focus`, `labels`; default `BOARD`), so
  Back and skip-ahead can rebuild any step instantly and frame it. Steps don't move the camera themselves, except through a played
  proof (the wrap-up). A step runs under a generation token and calls
  `gen.guard()` after every `await`, inside a beat's `prepare` too (a fast
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
- **Slabs are one instanced grid centred on the camera**, sorted outward,
  reaching as far as the floor is still visible. Only the cells the camera
  can see are drawn (`scene/area/visibleCells.ts`): the grid moves with the
  camera's target, so the list is rebuilt when the camera zooms or turns,
  never on a pan. A cell with no slab collapses in the vertex shader. So the
  area reaches the horizon at any zoom, with one shader. The slab is a
  rounded prism whose top edge is a modelled quarter-round. Labels start
  close to the edge, so the edge must stay nearly level there; a straight
  chamfer makes them run down the side. Cells whose tile is under
  `FACETED_BELOW_PX` pixels wide use a second mesh with one facet for each
  curve, which differs from the round one by less than a pixel there.
- **Eggs and goal columns are sparse, so they are listed.** The mask also
  marks which tiles hold an egg (`level.eggAt`) and which are goals. When
  the level, inputs or window change it is read back once, and the tiles
  within view are listed from it (`useMaskTiles`): a circle around the
  camera's target that covers the ground on screen (`viewRadius`), never
  past where the floor is visible. Eggs near the camera target use the full
  egg model and the rest a coarse one; the near circle is 40 tiles at the
  opening zoom and shrinks to nothing as the camera pulls back
  (`DETAILED_UNTIL`), since a far egg is a few pixels.
- **Panning a zoomed-out board must not stall.** A board like Even Out has
  tens of thousands of eggs in view, so: the window moves in steps of 32
  tiles, and a move alone is read back asynchronously (a new level or
  inputs is still read at once, so eggs never show the old board); the egg
  list is refreshed with a margin of an eighth of the view's reach; and
  each egg field writes per-egg state only for the few eggs with a frog, a
  hatch or a slot animation, found by binary search in the list (sorted by
  row, then column), resetting the ones it touched last time.
- Frogs and hatching shells are **instanced**.
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
  `CARD_LABEL`, `PILL`, `FOLD` (the code panel's fold transition, with
  `FOLD_MS` and `FOLD_EASE` for `element.animate()`), and
  `button(variant, size)`, whose shared base is `BUTTON` (for a one-off
  button such as Check). Variants are complete and never override each
  other — don't append utilities that conflict with a variant's.
- Use the theme's tokens (colours, `text-md`, shadows, eases, animations,
  the `xs` breakpoint) and Tailwind's scales before arbitrary values.

## The solver

Z3 runs as WebAssembly with threads, so the page must be **cross-origin
isolated** (`Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`); loading fails fast otherwise,
and can be retried. `pnpm dev` and `pnpm build` copy its browser build into
`public/z3/<version>/`, versioned so hosts can cache it forever (the copy
leaves the current version in place, so a running dev server keeps serving
it). It is loaded as a plain script, not bundled, because its thread workers
re-load it by URL, and warmed up (`warmSolver()`, from the actions in
`game/actions.ts`) once the player opens the level list, a level or the
tutorial, never on the home screen alone.

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
