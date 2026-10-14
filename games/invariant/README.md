# Invariant Frog

An interactive, visual website that teaches programmers what loop invariants are — by drawing an area that frogs can never hop out of.

- Each tile on an endless white plane is one program state; a **frog** hops once per loop iteration.
- You write a formula for an **area** (the loop invariant); tiles inside it rise as slabs.
- A skeptical **hand** checks three rules — Init, Preservation, Exit — and places a frog that breaks your area when one fails.
- Inputs that never change (like `n`) become **stacked ponds**, one per value.

See [docs/design.md](docs/design.md) for the full design.

## Running

```bash
npm install
npm run dev
```

The solver (Z3 compiled to WebAssembly) needs a cross-origin isolated page, so the dev and preview servers send
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Any production host must send
the same headers. `npm install` copies Z3's browser build into `public/z3/`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (parser, types, integer semantics, box search) |
| `npm run validate` | Proves every level's solutions with Z3, checks every pitfall fails the intended rule, and checks real frogs terminate |
| `npm run build` | Typecheck + production build |

## Layout

```
src/
  lang/        parser, type checker, AST, interpreter, symbolic body execution
  checker/     box search (nice counterexamples) + Z3 (proofs), verdicts
  levels/      level format + all v1 levels (defs/index.ts)
  scene/       react-three-fiber scene: tiles, slabs, eggs, frogs, hand, pond stack
  director/    choreography (hand, frog rain, replays) and the level check flow
  tutorial/    the scripted counter tutorial
  ui/          panels: code, caption, formula box, lights, pond slider, menu
scripts/       validate-levels.ts, copy-z3.mjs
```
