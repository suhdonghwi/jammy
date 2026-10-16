# jammy.fun

The hub for jammy.fun. It owns the domain and forwards each game's path to
that game's own Vercel project (see `vercel.json`):

| Path          | Project                                                          |
| ------------- | ---------------------------------------------------------------- |
| `/invariant/` | [invariant-frog](https://github.com/suhdonghwi/invariant-frog)   |

Each game builds with its path as Vite's `base` and serves itself under it,
so its own `*.vercel.app` URL (and preview deployments) work at the same path.

To add a game: give it the same setup, then add a redirect and a rewrite here
and a link on `index.html`.

www.jammy.fun redirects to jammy.fun through the domain's own settings in
Vercel (Project → Domains), not through `vercel.json`.
