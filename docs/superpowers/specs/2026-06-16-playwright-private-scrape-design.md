# Playwright private Instagram scrape — design spec

**Date:** 2026-06-16  
**Status:** Approved in brainstorming (pending implementation plan)  
**Audience:** Single-user deployment; multi-user deferred

## Problem

The app has two scrape paths today:

1. **Apify** (`apify/instagram-scraper`) — works for public URLs/search but cannot access private profile content.
2. **REST session API** (`server/instagramApi.js`) — cookie + User-Agent calls to Instagram internal endpoints; brittle (user-agent mismatch, cookie export UX) and limited to profile details + following/followers lists, not posts/reels.

**Goal for v1:** Scrape **profile metadata + posts/reels** from **private accounts the logged-in user can see**, using **browser automation that mimics real user behavior**.

## Requirements (v1)

| Area | Decision |
|------|----------|
| Data | Profile metadata + posts/reels from private (and public-to-you) profiles |
| Users | Single user; one Instagram session on server |
| Public scrapes | Keep Apify; migrate to Playwright in v2 |
| Auth | Server-side login persisted as Playwright `storageState` |
| Login UX | Dev: manual `storageState` bootstrap; Prod: live remote browser for login |
| Hosting | Playwright on Railway/Render/VPS (Docker); not Vercel serverless |

## Non-goals (v1)

- Multi-tenant user accounts and per-user session DB
- Stories, full comment threads, DMs
- Replacing Apify for public scrapes
- Accepting Instagram username/password in app forms
- Parallel Playwright jobs

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────┐
│  React UI       │────▶│  Express API (Railway Docker)         │
│  (static/Vercel │     │  ├─ POST /api/scrape → Apify (public) │
│   or same host) │     │  ├─ POST /api/scrape → Playwright (priv)│
└─────────────────┘     │  ├─ POST /api/instagram/login/start   │
                        │  ├─ GET  /api/instagram/login/:id     │
                        │  └─ data/storageState.json (volume)     │
                        │       Playwright (Chromium)             │
                        └──────────────────────────────────────┘
```

### Route rules

| Condition | Handler |
|-----------|---------|
| Search mode, comments, reels URL-only, no session | Apify |
| Profile URL + `resultsType: details` + valid session | Playwright (v1) |
| Profile URL + `resultsType: posts` + valid session | Playwright (v1) |
| `mode: connections` | REST API (`instagramApi.js`) for v1 |
| Profile URL, no session | Apify (public only) or error if private |

## Login flow

### Dev / bootstrap (implement first)

1. `npm run ig:login` — headed Chromium, user logs in at instagram.com, saves `data/storageState.json`.
2. Deploy `storageState.json` to Railway volume (upload script or admin endpoint).
3. Private scrapes require loadable `storageState`.

### Production (after bootstrap validated)

1. `POST /api/instagram/login/start` (protected by `ADMIN_SECRET`) → `{ loginId, liveUrl }`.
2. Server starts ephemeral Playwright context, opens Instagram login.
3. User completes login via **live browser view** (Browserbase live URL preferred; self-hosted noVNC alternative).
4. Server polls for logged-in state; saves `context.storageState({ path: 'data/storageState.json' })`.
5. TTL 15 minutes; tear down on success/failure.

### Session storage

- Path: `data/storageState.json` on persistent volume.
- Single file for single-user deployment.
- On checkpoint/login wall during scrape: surface reconnect error; do not log cookie contents.

### Security

- Protect login/upload endpoints with `ADMIN_SECRET`.
- `loginId` is UUID, short-lived, single-use.
- Never persist or log raw credentials.

## Private scrape behavior

### Pipeline (per profile)

1. Load `storageState` into new `BrowserContext`.
2. Navigate to `https://www.instagram.com/{username}/`.
3. Detect: profile loaded | login wall | private-not-following | not found.
4. **details:** extract metadata from DOM / embedded JSON.
5. **posts:** human-like scroll (random 1.5–4s delays, stepped `scrollBy`), intercept feed GraphQL/XHR; DOM fallback for post links.
6. Normalize to existing `ResultsView` item shape.
7. Close context; return `{ status: 'SUCCEEDED', source: 'playwright', items, itemCount }`.

### Human-like interaction

- One browser context per job; mutex (max 1 concurrent Playwright scrape).
- Fixed viewport 1280×900; locale `en-US`.
- `resultsLimit` caps scroll iterations (hard cap 50 posts for v1).
- Job timeout: 5 minutes.

### Extraction priorities

**Metadata:** username, fullName, biography, follower/following/post counts, isPrivate, profilePicUrl.

**Posts:** shortCode, url, caption, timestamp, likesCount, commentsCount, displayUrl/video URL, isVideo. Reels in grid included when URL matches `/reel/`.

### Errors (user-facing)

| Condition | Message |
|-----------|---------|
| Missing storageState | Connect Instagram first |
| Login wall | Session expired — reconnect |
| Private, not following | Cannot view this profile with your account |
| Checkpoint | Complete Instagram security check, then reconnect |
| Timeout | Profile did not load — retry |
| Throttle | Try later or reduce results limit |

## Components & file layout

### New modules

| File | Role |
|------|------|
| `server/playwright/browser.js` | Chromium launch, storageState load/save |
| `server/playwright/login.js` | Login session manager (dev + prod) |
| `server/playwright/scrapeProfile.js` | Profile navigation, scroll, orchestration |
| `server/playwright/network.js` | Parse feed API responses |
| `server/playwright/humanize.js` | Delays, scroll helpers |
| `server/privateScrape.js` | Input validation, mutex, API response |
| `server/sessionStore.js` | storageState filesystem + health |

### Modified

- `server/scrape.js` — dispatch private profile scrapes to `privateScrape.js`
- `server/app.js` — login endpoints
- `src/InstagramAuth.jsx` — Connect flow (live URL + dev instructions)
- `package.json` — `playwright`, `ig:login` script
- `Dockerfile` — Playwright + Chromium for Railway

### Deprecated in UI (v1)

- Cookie-Editor paste as primary connect flow (optional dev-only upload remains)

### Keep

- Apify for public/search
- `server/instagramApi.js` for connections mode until v2

## API additions

```
POST /api/instagram/login/start     → { loginId, liveUrl }
GET  /api/instagram/login/:id/status → { status: pending|success|failed, username? }
POST /api/instagram/session/upload   → admin only; body: storageState JSON (dev)
```

Existing `POST /api/scrape` body unchanged; routing logic selects Playwright vs Apify.

## Deployment

- **Railway Docker** recommended: `playwright install --with-deps chromium`, mount volume at `data/`.
- **Vercel:** static UI + optional lightweight API proxy only; no Playwright.
- Env: `ADMIN_SECRET`, `DATA_DIR=data`, optional `BROWSERBASE_API_KEY` for prod login.

## Testing

### Manual acceptance

1. `ig:login` saves session locally.
2. Private followed profile → details correct.
3. Same profile → posts returned with URLs/captions.
4. Public URL without session → Apify still works.
5. Bad/expired session → reconnect message.
6. Private non-followed → cannot view error.

### Automated

- Unit tests: `network.js` parsers with fixture JSON.
- Unit tests: `sessionStore.js` read/write.
- Playwright integration: manual/pre-release only (requires live session).

## v2 backlog

- Multi-user sessions (DB + per-user storageState).
- Migrate public scrapes from Apify to Playwright.
- Stories, comments; connections via Playwright.
- Playwright job queue if concurrency needed.

## Risks

- Instagram ToS and account restrictions — document for user; use conservative rate limits.
- Selectors/API shapes change — network interception + DOM fallback mitigates.
- Live login infra cost/complexity — bootstrap path de-risks v1 delivery.
