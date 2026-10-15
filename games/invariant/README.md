# Invariant Frog

An interactive, visual website that teaches programmers what loop invariants are — by drawing an area that frogs can never hop out of.

- Each tile on an endless white plane is one program state; a **frog** hops once per loop iteration.
- You write a formula for an **area** (the loop invariant); tiles inside it rise as slabs.
- A skeptical **hand** checks three rules — Init, Preservation, Exit — and places a frog that breaks your area when one fails.
- Inputs that never change (like `n`) become **stacked ponds**, one per value.

Docs:

- [docs/design.md](docs/design.md) — what the game teaches and the rules of its world
- [docs/experience.md](docs/experience.md) — how the interface should look, move and respond
- [docs/architecture.md](docs/architecture.md) — how the code is organised, and the rules that keep it working

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
