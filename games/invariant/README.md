# Invariant Frog

An interactive, visual website that teaches programmers what loop invariants are — by drawing an area that frogs can never hop out of.

- Each tile on an endless white plane is one program state; a **frog** hops once per loop iteration.
- You write a formula for an **area** (the loop invariant); tiles inside it rise as slabs.
- A skeptical **hand** checks three rules — Init, Preservation, Exit — and places a frog that breaks your area when one fails.
- Inputs that never change (like `n`) become **stacked ponds**, one per value.

See [docs/design.md](docs/design.md) for the full design.

## Running

```bash
pnpm install
pnpm dev
```

The solver (Z3 compiled to WebAssembly) needs a cross-origin isolated page, so the dev and preview servers send
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Any production host must send
the same headers. `pnpm install` copies Z3's browser build into `public/z3/`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm test` | Unit tests (parser, types, integer semantics, box search) |
| `pnpm validate` | Proves every level's solutions with Z3, checks every pitfall fails the intended rule, and checks real frogs terminate |
| `pnpm build` | Typecheck + production build |

## Layout

```
src/
  main.tsx, App.tsx   entry point and the page's top-level layout
  lang/        parser, type checker, AST, interpreter, symbolic body execution
  checker/     box search (nice counterexamples) + Z3 (proofs), verdicts
  levels/      the level format (level.ts) and every level (catalog.ts)
  game/        the zustand store, and what the app's buttons do (actions.ts)
  director/    scripted sequences: the hand, Step/Run, check playback, the pond cinematic
  tutorial/    the tutorial's steps, and the beat/caption helpers they are written with
  scene/       the 3D world (react-three-fiber)
    floor/       the infinite floor, drawn per pixel from the level's formulas
    area/        the learner's slabs, eggs and goal columns
    frogs/       frog state, motion, rendering, hatching
    hand/        the skeptical hand
    labels/      tags over tiles and frogs (callouts, failures, frog values)
    level/       a level's scene, the pond elevator, hover preview, cinematic
    home/        the home screen's scene
    shaders/     shared GLSL and formulas → GLSL
  ui/          the DOM over the scene, styled with Tailwind classes (shared ones in classes.ts)
    hud/         level screen: top bar, code panel, caption, formula box, controls
    home/        title (3D lettering), home copy, level list
    rules/       the rules card
  styles.css   Tailwind setup: design tokens, keyframes, the page, the tutorial spotlight
scripts/       validate-levels.ts, copy-z3.mjs
```
