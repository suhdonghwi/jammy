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

The game is public at https://invariant.donghwi.me/. Its root serves the
game build with the isolation headers required by Z3. On jammy.fun,
`/invariant` and its descendants permanently redirect to the game domain.
Other unknown hub paths temporarily redirect to the landing page.
