# Importing a game into the hub

Each "Can You ..." game is built and tested in its own project. The hub imports a snapshot of it: the built client,
the API code and the content the API reads. Players see one site: the game at `/<id>/`, its API at `/api/<id>/*`.

```sh
npm run games:check -- ../canyounew     # does the project meet the contract? changes nothing
npm run games:import -- ../canyounew    # first import; adds it to games.sources.json
npm run games:import -- survive         # re-import one game after changing it
npm run games:import                    # re-import every game
npm run games:list                      # what is imported, from which commit
```

`--skip-checks` skips the game's own `typecheck` and `test` scripts (they run by default and block the import).

## What an import does

1. Validates `cyd.game.json` and the hooks below.
2. Runs the game's `npm run typecheck` and `npm test`.
3. Builds the client with `vite build --base /<id>/`, `VITE_API_BASE=/api/<id>` and `VITE_CYD_HUB=1`, and warns about
   root-absolute URLs that escape `/<id>/`.
4. Copies the API folder, its source folders and the listed content into `imported/<id>/server/`, and refuses packages
   the hub does not have installed.
5. Writes `imported/<id>/game.json` (card data, routes, source commit) and swaps it in. A failed import leaves the last
   good one in place.
6. Regenerates `api/<id>.ts` (one function per game that dispatches to its handlers, since Vercel Hobby allows 12 per deployment), `api/_cyd/<id>.ts` (env setup),
   `vercel.json` and `apps/web/src/games.generated.ts`, which drives the hub cards.

Commit `imported/` and the generated files. Vercel deploys the hub on its own and cannot see the game projects.

## The contract

### `cyd.game.json` at the project root

```json
{
  "id": "survive",
  "name": "Can You Survive",
  "tagline": "Nine rounds, three hearts, one boss. A new board every day.",
  "kind": "luck",
  "accentColor": "#c8461e",
  "config": "content/config.json",
  "envPrefix": "CYS",
  "server": {
    "apiDir": "api",
    "sources": ["lib"],
    "include": ["content/**/*.json"]
  }
}
```

| Field | |
|---|---|
| `id` | URL segment and storage namespace. Lowercase; not `hub`, `api`, `about`, `archive`, `assets`, `imported`, `shared`. |
| `name`, `tagline` | Hub card text. The name starts with "Can You ". Tagline up to 90 characters. |
| `kind` | `luck`, `skill`, `crowd` or `knowledge`. |
| `accentColor` | Card color. White text sits on it, so keep it dark enough (4.5:1). The hub may override it with a token. |
| `config` | JSON file with `launchDate` (puzzle #1) and `timezone`, which must be `America/Chicago`. Or put both in this file. |
| `envPrefix` | Prefix for the server hooks below. |
| `server.apiDir` | Folder whose `.ts` files are the API functions. `api/run.ts` is served at `/api/<id>/run`. Files starting with `_` are skipped. |
| `server.sources` | Other folders the functions import (relative imports only, or packages the hub has). |
| `server.contentDir` | Optional, default `content`. Where the server reads content from. |
| `server.include` | Globs of content files the API reads at runtime. |

### Server hooks

Read these, with your standalone behavior as the fallback:

- `<PREFIX>_CONTENT_DIR`: where content lives (standalone: `<cwd>/content`).
- `<PREFIX>_DATA_DIR`: where a local dev store may write (standalone: `<cwd>/.data`).
- `<PREFIX>_KEY_PREFIX`: prepend it to every Redis key. All games share one Redis in the hub, and without it two games'
  `stats:<date>` keys collide.

Handlers are Node-style `export default (req, res) => ...` Vercel functions. Use your own cookie name for the run token
(cookies are shared across the origin).

### Client hooks

- Build with Vite from `web/` and use relative or Vite-handled asset URLs, so `--base /<id>/` works.
- Call the API at `import.meta.env.VITE_API_BASE ?? '<standalone path>'`.
- Write today's status for the hub to `localStorage['cy:v1:<id>:<YYYY-MM-DD>']`:
  `{ "status": "in_progress" }` once the player has really started, then
  `{ "status": "done", "score": "7/10", "finishedAt": "<ISO>" }` when the run ends. `score` is the short text on the card.
  Never downgrade a `done` day. See `web/src/lib/hub.ts` in either game for a drop-in version.
- Prefix any other localStorage keys with something game-specific (`cys_`, `cyc_`); the origin is shared.

## Local development

`npm run dev` in the hub serves imported games from `imported/<id>/web` and runs their API in-process, with local runs
in `.data/<id>/`. That is a built snapshot, so for day-to-day work on a game run it standalone in its own project, then
re-import.

## Hub-side extras

The hover preview on a card lives in the hub (`games/<id>/src/Preview.tsx`, registered in `apps/web/src/games.ts`).
A game without one still gets a card.
