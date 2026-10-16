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
