# jammy

The games on [jammy.fun](https://jammy.fun), and the hub that serves them, in one pnpm workspace.

```
hub/               the jammy.fun landing page; owns the domain and forwards each game's path
games/invariant/   Invariant Frog, served at jammy.fun/invariant/
```

Each folder is its own Vercel project, with the folder as its Root Directory:

| Folder             | Vercel project   | Serves                                                     |
| ------------------ | ---------------- | ---------------------------------------------------------- |
| `hub/`             | `jammy`          | `jammy.fun`, forwarding `/invariant/` to the project below |
| `games/invariant/` | `invariant-frog` | `invariant-frog.vercel.app/invariant/`                     |

So a game deploys on its own, and its `vercel.json` (headers, build command, base path) stays next to its code.
The hub only holds rewrites; see [hub/README.md](hub/README.md).

## Working here

```bash
pnpm install                                   # every game, plus each one's postinstall
pnpm --filter invariant-frog dev               # one game's dev server
pnpm --filter invariant-frog test
BASE_PATH=/invariant/ pnpm --filter invariant-frog build
```

There is one lockfile, at the root. Workspace-wide pnpm settings (such as `onlyBuiltDependencies`) live in
`pnpm-workspace.yaml`, since pnpm ignores the `pnpm` field in a package's own `package.json`.

## Adding a game

1. Put it in `games/<name>/` with its own `package.json`, and run `pnpm install` at the root.
   To bring in an existing repo with its history, rewrite its paths under `games/<name>/` in a scratch clone
   (`git filter-repo --to-subdirectory-filter games/<name>`) and merge that with `--allow-unrelated-histories`.
2. Build it with `/<name>/` as Vite's `base`, and give it a `vercel.json` that serves it under that path,
   like `games/invariant/vercel.json`, so its own `*.vercel.app` URL and preview deployments work at the same path.
3. Make a Vercel project for it from this repo, with Root Directory `games/<name>`.
4. In `hub/vercel.json`, add a redirect from `/<name>` and rewrites for `/<name>/` and `/<name>/:path*`;
   add a card to `hub/index.html` and a row to `hub/README.md`.
5. If it has checks to run, add a workflow under `.github/workflows/`, limited to its folder with `paths`.
