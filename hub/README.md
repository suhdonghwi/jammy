# jammy.fun

The hub for jammy.fun. It owns the domain and forwards each game's path to
that game's own Vercel project (see `vercel.json`):

| Path          | Project                                |
| ------------- | -------------------------------------- |
| `/invariant/` | [invariant-frog](../games/invariant/)  |

Each game builds with its path as Vite's `base` and serves itself under it,
so its own `*.vercel.app` URL (and preview deployments) work at the same path.

To add a game, see the root [README](../README.md#adding-a-game).

www.jammy.fun redirects to jammy.fun through the domain's own settings in
Vercel (Project → Domains), not through `vercel.json`.

Any other path redirects to the landing page (a temporary redirect, so a game
added later at a new path is never shadowed by a cached one). Paths a game
doesn't have reach that game, whose `404.html` sends the visitor here too.
