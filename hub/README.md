# jammy.fun

The landing page for jammy.fun.

The whole site is one Vercel project, deployed from the repository root
(see `/vercel.json`). `pnpm build` at the root assembles it in `dist/`:

| Path          | From                                   |
| ------------- | -------------------------------------- |
| `/`           | `hub/index.html`                       |
| `/invariant/` | [Invariant Frog](../games/invariant/)'s build |

Each game builds with its path as Vite's `base`. One deployment serves the
landing page and every game together, so a page and the assets it asks for
always come from the same build.

www.jammy.fun redirects to jammy.fun through the domain's own settings in
Vercel (Project → Domains), not through `vercel.json`.

Any other path redirects to the landing page (a temporary redirect, so a game
added later at a new path is never shadowed by a cached one). A path under a
game that doesn't exist gets `404.html`, which sends the visitor here too.
