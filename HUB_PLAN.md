# Can You Daily: Hub Plan

Status: planning spec v1, to be built in Claude Code. This plan covers the shared site that holds every "Can You..." game, and it supersedes the standalone repo layouts in `can-you-survive/docs/PLAN.md` and `can-you-compare/docs/PLAN.md` (see section 14).

## 1. What it is

One website, one domain, many daily games. The hub is the front door: it shows today's games, what you have finished, and a combined streak. Each game lives on its own page under the same domain and shares the daily system, share card format, and backend.

Launch games: Can You Survive and Can You Compare. More follow one at a time.

## 2. Brand and domain

- Working umbrella brand: **Can You Daily**. Each game keeps its own "Can You ..." name.
- Domain: not decided. The only candidate confirmed available by the owner so far is `canyoudaily.io`. Other names to check at a registrar: `canyoudaily.com`, `.games`, `.app`, `playcanyou.com`, `canyougames.com`. Availability must be checked before committing.
- Choose a domain that matches the brand name exactly. Register obvious variants and redirect them to the main domain if cheap.
- Before committing: check matching social handles and run a quick trademark search ("Can You" alone is generic, "Can You Daily" is more distinctive). This is a sanity check, not legal advice.
- Everything in this plan is domain-agnostic. The domain is configuration, not code.

## 3. Why one site

- Browser storage is tied to the exact origin, so separate domains cannot share streaks or "played today" status without accounts. One origin with path routes shares them for free.
- The hub is the daily habit: a visitor who comes for one game sees the others.
- The daily reset, run tokens, share card, and backend are written once.
- All game pages build the same domain's reputation in search.
- If a game outgrows the shell later, it can move to its own domain with a link back from the hub.

## 4. Site map

```
/                  Hub
/survive           Can You Survive
/compare           Can You Compare
/about             What this is, how daily games work, FAQ
/archive           Past results for the player (v2)
/api/survive/...   Game APIs, one folder per game
/api/compare/...
/api/hub/...       Shared endpoints (status, stats)
```

Each game route is lazy-loaded so a visitor only downloads the game they open.

## 5. Hub page

Purpose: show what is playable today and move the player on to the next unplayed game.

Content, top to bottom:
1. Header: wordmark, theme toggle.
2. Today's games, one card per game, unplayed first:
   - game name, one-line tagline, accent color
   - state: Not started, In progress, or Done with the score and a share button
   - primary button: Play, Resume, or View result
3. Streak strip: combined daily streak and best streak (see section 8).
4. Next reset countdown (midnight America/Chicago).
5. Coming soon: one or two tease cards for games on the roadmap (name and one-line description only).
6. Footer: about, feedback link, report-a-problem.

States and rules:
- First visit with no storage shows all cards as Not started and a short "How it works" line.
- If the day rolls over while the page is open, reload to the new day at reset.
- The hub reads state from shared storage only. It never needs the game's code to render a card.

## 6. Shared package

A shared package used by every game. Nothing game-specific lives here.

Contents:
- **Daily clock:** date key in America/Chicago (`YYYY-MM-DD`), seconds to reset, per-game puzzle number from the game's launch date. DST is handled by using the timezone, not fixed offsets.
- **Run handling:** run token (cookie plus localStorage), start or resume today's run, one play per day, server-side progress.
- **Storage helpers:** safe localStorage wrapper that never throws, namespaced keys (section 7).
- **Share card builder:** standard header line `Can You <Game> #<n>`, then the game's result lines, plus the link. Text-only fallback for accessibility.
- **API helpers:** HMAC-based daily secrets, per-IP and per-run rate limiting, error shape.
- **Theme and shell:** design tokens, light and dark themes, header and footer, page layout, countdown component.
- **Analytics wrapper:** the event names in section 11.

## 7. Client storage

Keys follow `cy:v1:<game>:<date>` for per-day state and `cy:v1:meta` for series data.

```
cy:v1:survive:2026-10-12   { status, round, results[], score, finishedAt }
cy:v1:compare:2026-10-12   { status, index, answers[], score, finishedAt }
cy:v1:meta                 { streak, bestStreak, lastPlayedDate, gameStreaks{} }
```

- Server progress is the source of truth. Local state is a cache so the hub renders instantly.
- If storage is empty or blocked, the hub falls back to a single `/api/hub/status` call keyed by the run token, and if that fails it shows all cards as Not started.
- Schema is versioned (`v1`) so a later change can migrate keys.

## 8. Streaks

- **Per-game streak:** consecutive days a game was completed.
- **Series streak (shown on the hub):** consecutive days with at least one game completed. This is the assumed rule, to be confirmed.
- A day counts when a run reaches a final result, not when it is started.
- A missed day resets the streak. No freezes in v1.
- Stored locally in v1. Accounts later would let streaks follow the player across devices.

## 9. Game plug-in contract

Each game registers with the hub through a manifest and exposes a small interface. Adding a game should not require editing hub code beyond registering it.

```
manifest:
  id:            "survive"
  slug:          "survive"
  name:          "Can You Survive"
  tagline:       one line
  accent:        design token name
  launchDate:    "2026-xx-xx"       (puzzle #1)
  kind:          "luck" | "skill" | "crowd" | "knowledge"
  component:     lazy route component
  api:           "/api/survive"

interface (per game):
  getTodayState(dateKey)     -> { status, summary, score? }
  buildShareText(state)      -> lines after the standard header
  getTeaser(dateKey+1)       -> optional one-line preview of tomorrow
```

Rules:
- A game owns its own rules, content, and API. The hub owns navigation, status, streaks, and the shell.
- Games never read each other's storage keys.
- The hub renders a card from the manifest plus `getTodayState`, so a game that fails to load shows a graceful error card instead of breaking the page.

## 10. Daily system shared by all games

- One reset time for every game: midnight America/Chicago.
- Same date key and the same server clock for all games.
- Per-game puzzle numbering starts at #1 on that game's launch date.
- Each game keeps its own content schedule (`content/schedule/` in its folder) and a fallback generator so a missing day never takes the game down.
- Shared rule: no game may ship unless it has 60 days of content ready, and at least 14 days ahead of the live date generated and reviewed.

## 11. Metrics

Use a privacy-light analytics tool (for example Vercel Analytics or Plausible; Claude Code to confirm). No personal data. Events:

- `hub_view`, `game_card_click`
- `game_start`, `game_complete` (with game id and score)
- `share_click`, `share_copy`
- `report_click`
- Return visits measured by day-1 and day-7 returns on the anonymous run token

Series-level numbers to watch:
- Percent of players who complete two or more games in a day.
- Day-7 return rate.
- Share rate per game.
- Completion rate per game.

Use these to decide which games to improve, extend, or retire.

## 12. SEO and sharing

- Each game page has its own title, description, and short rules text. Prerender or statically render this content so search engines can read it without running the game.
- Page titles follow `Can You Survive: a daily survival game | Can You Daily` style (exact wording to be chosen in Claude Code).
- Open Graph and Twitter preview tags on every page, with a per-game preview image.
- Share text includes the link to the specific game page, not just the hub.
- Every game page and result screen links to the hub and to the next unplayed game.
- Realistic expectation: "can you survive" is a generic phrase and a new site will not rank for it soon. Sharing is the main discovery channel for daily games.

## 13. Suggested tech (Claude Code to confirm)

- Monorepo with workspaces (pnpm or npm).
- Front end: one Vite + React app with a route per game (lazy loaded), Tailwind, and GSAP where a game needs it.
- Back end: Vercel serverless functions in `api/`, shared helpers from the shared package.
- Storage: Upstash Redis or Supabase with key prefixes per game.
- Content scripts: Python per game, kept in each game's folder.

## 14. Repo structure

This replaces the standalone `can-you-survive/` and `can-you-compare/` folders from their plans.

```
can-you-daily/
  docs/
    HUB_PLAN.md
    survive/PLAN.md          (moved from can-you-survive/docs)
    compare/PLAN.md          (moved from can-you-compare/docs)
  apps/
    web/                     one Vite + React app: hub, shell, routes
  packages/
    shared/                  clock, runs, storage, share card, theme, analytics
  games/
    survive/                 UI, rounds, activities, API handlers
    compare/                 UI, pair screens, API handlers
  api/                       Vercel functions entrypoints per game
  content/
    survive/                 datasets, templates, schedule
    compare/                 metrics, items, schedule
  scripts/                   generators, checkers, odds tools
```

Mapping from the game plans:
- `web/` in each game plan becomes `games/<game>/` plus routes in `apps/web`.
- `content/` in each game plan becomes `content/<game>/`.
- `api/` in each game plan becomes functions under `api/<game>/`.
- Their "series hub" phase is replaced by this plan.

## 15. Build phases

1. Foundation: monorepo, shared package (clock, storage, run handling, share card, theme), shell, empty hub with the game registry.
2. Hub MVP: game cards with state, streak strip, reset countdown, coming-soon cards, about page.
3. First game integration: Can You Survive core loop (see its plan), wired to the hub and share card.
4. Second game integration: Can You Compare core loop, wired the same way.
5. Launch polish: SEO tags and prerendering, preview images, analytics events, error states, accessibility pass.
6. Content readiness gate: 60 days per game ready, 14 days reviewed.
7. After launch: stats ("X of Y finished today"), optional accounts for cross-device streaks, archive page, and the next game.

## 16. Quality bar

- Phone-first layout, usable at 360 px wide, with a minimum 16 px side gutter.
- Light and dark themes with proper contrast. Share squares always accompanied by text so the card reads without color.
- Keyboard-navigable controls and visible focus.
- No game logic in the hub. A broken game must not break the hub.
- Every answer, outcome, and secret stays on the server until the player locks in (each game's plan has the details).

## 17. Decisions locked

- One site, one domain, games as routes. Not separate sites.
- Hub is the front door with today's status and a series streak.
- Working brand: Can You Daily.
- One shared daily system: midnight America/Chicago, per-game puzzle numbers, shared share card format.
- Monorepo with a shared package and one folder per game.
- Launch with Can You Survive and Can You Compare. Add games one at a time.

## 18. Open items and assumptions

- Final domain and brand name. Check availability and trademark before purchase.
- Assumed series streak = at least one game completed per day. Confirm.
- Assumed no accounts in v1, so streaks are per browser.
- Hub tease content: show the next game's name only, or a preview of tomorrow's activity? Decide.
- Visual identity: shared wordmark and tokens, one accent per game. Direction not chosen.
- Analytics tool choice.
- Whether the archive page is v1 or v2.
- Launch date and which game launches first if they cannot ship together.
