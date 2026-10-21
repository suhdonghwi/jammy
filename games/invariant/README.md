# Invariant Frog

An interactive, visual website that teaches programmers what loop invariants are — by drawing an area that frogs can never hop out of.

- Each tile on an endless white plane is one program state; a **frog** hops once per loop iteration.
- You write a formula for an **area** (the loop invariant); tiles inside it rise as slabs.
- **Check** tests three rules — Initialization, Maintenance, Termination — and, when one fails, shows a see-through **ghost frog** that breaks your area.
- Inputs that never change (like `n`, or an array `A`) become **planes**, one per value, picked in the inputs card under the code.
- Read-only arrays: `A[k]`, and `forall` / `exists` over a range of cells, with Z3 proving the quantified rules.
- In English and Korean (한국어), switched on the home screen.

Docs:

- [docs/design.md](docs/design.md) — what the game teaches, the rules of its world, and the tutorial's vocabulary
- [docs/experience.md](docs/experience.md) — how the interface should look, move and respond
- [docs/architecture.md](docs/architecture.md) — how the code is organised, and the rules that keep it working

## Running

```bash
pnpm install
pnpm dev
```

The solver (Z3 compiled to WebAssembly) needs a cross-origin isolated page, so the dev and preview servers send
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Any production host must send
the same headers. `pnpm dev` and `pnpm build` copy Z3's browser build into `public/z3/<version>/`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm typecheck` | Typecheck only |
| `pnpm test` | Unit tests (parser, types, integer semantics, box search) |
| `pnpm validate` | Proves every level's solutions with Z3, checks every pitfall fails the intended rule, checks real frogs terminate, and checks no hint gives a solution away |
| `pnpm build` | Typecheck + production build |
| `pnpm preview` | Serves the production build with the solver's headers |
| `pnpm fonts` | Rebuilds the Korean font subsets in `src/assets/fonts/` |
| `pnpm og` | Redraws the link preview image, `public/og.png`, by screenshotting the game's `?poster` page in the system Chrome |
