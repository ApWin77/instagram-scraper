# Playwright Private Instagram Scrape — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape private Instagram profile metadata and posts/reels via Playwright using a server-side `storageState` session, while keeping Apify for public scrapes.

**Architecture:** Express on Railway Docker runs Playwright Chromium. Session lives at `data/storageState.json` (volume). `POST /api/scrape` routes profile `posts`/`details` to Playwright when session exists; everything else stays on Apify. Dev bootstrap via `npm run ig:login`; prod live-browser login is Phase 2.

**Tech Stack:** Node 20+, Express 5, Playwright, React/Vite, Apify Client, Node built-in `node:test`

**Spec:** `docs/superpowers/specs/2026-06-16-playwright-private-scrape-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `server/sessionStore.js` | Read/write `storageState.json`, `hasSession()`, paths from `DATA_DIR` |
| `server/playwright/humanize.js` | `randomDelay`, `scrollStep` |
| `server/playwright/network.js` | Parse feed JSON → normalized post items |
| `server/playwright/browser.js` | Launch Chromium, create context from storageState |
| `server/playwright/scrapeProfile.js` | Navigate profile, scroll, extract metadata + posts |
| `server/privateScrape.js` | Mutex, validate input, orchestrate scrape, API response shape |
| `scripts/ig-login.js` | Headed login → save storageState |
| `server/scrape.js` | Route Playwright vs Apify vs REST connections |
| `server/app.js` | `/api/instagram/status`, `/api/instagram/session/upload` |
| `src/InstagramAuth.jsx` | Show server connection status; dev instructions |
| `Dockerfile` | Playwright + Chromium for Railway |
| `tests/server/*.test.js` | Unit tests (node:test) |

---

### Task 1: Test harness and dependencies

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.example`
- Create: `tests/server/network.test.js` (empty placeholder removed in Task 3)

- [ ] **Step 1: Add Playwright and test script**

Modify `package.json`:

```json
{
  "scripts": {
    "test": "node --test tests/server/**/*.test.js",
    "ig:login": "node scripts/ig-login.js"
  },
  "dependencies": {
    "playwright": "^1.51.0"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Ignore session data**

Add to `.gitignore`:

```
data/
```

- [ ] **Step 3: Document env vars**

Add to `.env.example`:

```
APIFY_TOKEN=
PORT=3001
DATA_DIR=data
ADMIN_SECRET=change-me
PLAYWRIGHT_HEADLESS=true
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add playwright dependency and test harness"
```

---

### Task 2: Session store

**Files:**
- Create: `server/sessionStore.js`
- Create: `tests/server/sessionStore.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/server/sessionStore.test.js`:

```javascript
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

let dataDir
let store

afterEach(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('hasSession returns false when file missing', async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ig-session-'))
  store = await import('../../server/sessionStore.js')
  assert.equal(store.hasSession(dataDir), false)
})

test('hasSession returns true when storageState exists', async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ig-session-'))
  store = await import('../../server/sessionStore.js')
  await writeFile(join(dataDir, 'storageState.json'), '{"cookies":[]}')
  assert.equal(store.hasSession(dataDir), true)
})

test('getStorageStatePath joins DATA_DIR', async () => {
  store = await import('../../server/sessionStore.js')
  assert.equal(
    store.getStorageStatePath('/tmp/data'),
    '/tmp/data/storageState.json',
  )
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test`
Expected: FAIL — module `sessionStore.js` not found

- [ ] **Step 3: Implement sessionStore**

Create `server/sessionStore.js`:

```javascript
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DEFAULT_DATA_DIR = 'data'
const STORAGE_FILE = 'storageState.json'

export function getDataDir(override) {
  return override ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR
}

export function getStorageStatePath(dataDir = getDataDir()) {
  return join(dataDir, STORAGE_FILE)
}

export function hasSession(dataDir = getDataDir()) {
  return existsSync(getStorageStatePath(dataDir))
}

export async function readStorageState(dataDir = getDataDir()) {
  const path = getStorageStatePath(dataDir)
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

export async function writeStorageState(state, dataDir = getDataDir()) {
  const path = getStorageStatePath(dataDir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), 'utf8')
}

export function storageStateToCookieMap(state) {
  const map = {}
  for (const cookie of state.cookies ?? []) {
    if (cookie.name && cookie.value != null) {
      map[cookie.name] = String(cookie.value)
    }
  }
  return map
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test`
Expected: PASS (sessionStore tests)

- [ ] **Step 5: Commit**

```bash
git add server/sessionStore.js tests/server/sessionStore.test.js
git commit -m "feat: add Playwright storageState session store"
```

---

### Task 3: Network response parsers

**Files:**
- Create: `server/playwright/network.js`
- Create: `tests/server/network.test.js`
- Create: `tests/fixtures/instagram-feed-user.json`

- [ ] **Step 1: Add fixture**

Create `tests/fixtures/instagram-feed-user.json` (minimal shape):

```json
{
  "items": [
    {
      "pk": "123",
      "code": "ABC123",
      "caption": { "text": "Hello world" },
      "taken_at": 1710000000,
      "like_count": 42,
      "comment_count": 3,
      "image_versions2": {
        "candidates": [{ "url": "https://cdn.example/photo.jpg" }]
      },
      "media_type": 1
    }
  ]
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/server/network.test.js`:

```javascript
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedItems, parseProfileFromSharedData } from '../../server/playwright/network.js'

test('parseFeedItems maps Instagram feed items', async () => {
  const raw = await readFile('tests/fixtures/instagram-feed-user.json', 'utf8')
  const data = JSON.parse(raw)
  const items = parseFeedItems(data.items, 'targetuser')
  assert.equal(items.length, 1)
  assert.equal(items[0].shortCode, 'ABC123')
  assert.equal(items[0].url, 'https://www.instagram.com/p/ABC123/')
  assert.equal(items[0].caption, 'Hello world')
  assert.equal(items[0].likesCount, 42)
  assert.equal(items[0].ownerUsername, 'targetuser')
})

test('parseProfileFromSharedData extracts username and bio', () => {
  const profile = parseProfileFromSharedData({
    username: 'jane',
    full_name: 'Jane Doe',
    biography: 'Bio text',
    edge_followed_by: { count: 100 },
    edge_follow: { count: 50 },
    edge_owner_to_timeline_media: { count: 10 },
    is_private: true,
    profile_pic_url_hd: 'https://cdn.example/pic.jpg',
  })
  assert.equal(profile.username, 'jane')
  assert.equal(profile.followersCount, 100)
  assert.equal(profile.isPrivate, true)
})
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test`
Expected: FAIL — `network.js` not found

- [ ] **Step 4: Implement network.js**

Create `server/playwright/network.js`:

```javascript
export function parseFeedItems(rawItems, ownerUsername) {
  if (!Array.isArray(rawItems)) return []

  return rawItems
    .map((item) => mapFeedItem(item, ownerUsername))
    .filter(Boolean)
}

function mapFeedItem(item, ownerUsername) {
  const code = item.code ?? item.shortcode
  if (!code) return null

  const isVideo = item.media_type === 2 || Boolean(item.video_versions?.length)
  const path = isVideo ? 'reel' : 'p'

  return {
    id: item.pk ?? item.id ?? code,
    shortCode: code,
    url: `https://www.instagram.com/${path}/${code}/`,
    caption: item.caption?.text ?? '',
    timestamp: item.taken_at ?? item.device_timestamp ?? null,
    likesCount: item.like_count ?? null,
    commentsCount: item.comment_count ?? null,
    displayUrl:
      item.image_versions2?.candidates?.[0]?.url ??
      item.video_versions?.[0]?.url ??
      null,
    isVideo,
    ownerUsername,
  }
}

export function parseProfileFromSharedData(user) {
  if (!user?.username) return null

  return {
    id: user.id ?? user.pk ?? null,
    username: user.username,
    fullName: user.full_name ?? '',
    biography: user.biography ?? '',
    followersCount: user.edge_followed_by?.count ?? user.follower_count ?? null,
    followsCount: user.edge_follow?.count ?? user.following_count ?? null,
    postsCount:
      user.edge_owner_to_timeline_media?.count ?? user.media_count ?? null,
    isPrivate: Boolean(user.is_private),
    isVerified: Boolean(user.is_verified),
    profilePicUrl: user.profile_pic_url_hd ?? user.profile_pic_url ?? null,
  }
}

export function extractFeedFromResponseBody(body) {
  if (!body || typeof body !== 'object') return []

  if (Array.isArray(body.items)) return body.items

  const timeline =
    body.data?.user?.edge_owner_to_timeline_media?.edges ??
    body.user?.edge_owner_to_timeline_media?.edges

  if (Array.isArray(timeline)) {
    return timeline.map((edge) => edge.node).filter(Boolean)
  }

  return []
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add server/playwright/network.js tests/server/network.test.js tests/fixtures/instagram-feed-user.json
git commit -m "feat: add Instagram feed and profile response parsers"
```

---

### Task 4: Humanize helpers

**Files:**
- Create: `server/playwright/humanize.js`
- Create: `tests/server/humanize.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/server/humanize.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampLimit, randomDelayMs } from '../../server/playwright/humanize.js'

test('clampLimit enforces max 50', () => {
  assert.equal(clampLimit(100), 50)
  assert.equal(clampLimit(10), 10)
  assert.equal(clampLimit(0), 1)
})

test('randomDelayMs stays within bounds', () => {
  for (let i = 0; i < 20; i++) {
    const ms = randomDelayMs(1500, 4000)
    assert.ok(ms >= 1500 && ms <= 4000)
  }
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

Create `server/playwright/humanize.js`:

```javascript
export function clampLimit(limit, max = 50) {
  const n = Number(limit)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, max)
}

export function randomDelayMs(min = 1500, max = 4000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function scrollPage(page, pixels = 600) {
  await page.evaluate((y) => window.scrollBy(0, y), pixels)
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add server/playwright/humanize.js tests/server/humanize.test.js
git commit -m "feat: add human-like scroll and delay helpers"
```

---

### Task 5: Browser factory

**Files:**
- Create: `server/playwright/browser.js`

- [ ] **Step 1: Implement browser.js**

Create `server/playwright/browser.js`:

```javascript
import { chromium } from 'playwright'
import { getStorageStatePath, hasSession } from '../sessionStore.js'

const VIEWPORT = { width: 1280, height: 900 }

export async function launchBrowser() {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false'
  return chromium.launch({ headless })
}

export async function createAuthenticatedContext(browser, dataDir) {
  if (!hasSession(dataDir)) {
    const err = new Error('Connect Instagram first.')
    err.statusCode = 401
    throw err
  }

  return browser.newContext({
    storageState: getStorageStatePath(dataDir),
    viewport: VIEWPORT,
    locale: 'en-US',
    userAgent: process.env.PLAYWRIGHT_USER_AGENT || undefined,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add server/playwright/browser.js
git commit -m "feat: add Playwright browser factory with storageState"
```

---

### Task 6: Profile scraper

**Files:**
- Create: `server/playwright/scrapeProfile.js`

- [ ] **Step 1: Implement scrapeProfile.js**

Create `server/playwright/scrapeProfile.js`:

```javascript
import {
  extractFeedFromResponseBody,
  parseFeedItems,
  parseProfileFromSharedData,
} from './network.js'
import { clampLimit, delay, randomDelayMs, scrollPage } from './humanize.js'

const PROFILE_TIMEOUT_MS = 60_000

export async function scrapeProfile(page, username, { resultsType, resultsLimit }) {
  const feedItems = []
  const limit = clampLimit(resultsLimit)

  page.on('response', async (response) => {
    try {
      const url = response.url()
      if (!url.includes('/api/v1/') && !url.includes('graphql')) return
      if (!url.includes('feed') && !url.includes('timeline')) return
      const json = await response.json()
      const raw = extractFeedFromResponseBody(json)
      feedItems.push(...parseFeedItems(raw, username))
    } catch {
      // ignore non-JSON
    }
  })

  await page.goto(`https://www.instagram.com/${username}/`, {
    waitUntil: 'domcontentloaded',
    timeout: PROFILE_TIMEOUT_MS,
  })

  await detectProfileBlockers(page)

  const profile = await extractProfileMetadata(page, username)
  if (!profile) {
    const err = new Error(`Profile @${username} was not found.`)
    err.statusCode = 404
    throw err
  }

  if (resultsType === 'details') {
    return [profile]
  }

  const domPosts = await collectPostsFromDom(page, username)
  const merged = dedupeByShortCode([...feedItems, ...domPosts]).slice(0, limit)

  if (merged.length < limit) {
    for (let i = 0; i < limit && merged.length < limit; i++) {
      await scrollPage(page, 700)
      await delay(randomDelayMs())
      const more = await collectPostsFromDom(page, username)
      for (const post of more) {
        if (!merged.find((p) => p.shortCode === post.shortCode)) {
          merged.push(post)
        }
        if (merged.length >= limit) break
      }
    }
  }

  return [profile, ...merged.slice(0, limit)]
}

async function detectProfileBlockers(page) {
  const url = page.url()
  if (url.includes('/accounts/login')) {
    const err = new Error('Session expired — reconnect Instagram.')
    err.statusCode = 401
    throw err
  }

  const text = await page.locator('body').innerText()
  if (/isn't available|Page Not Found/i.test(text)) {
    const err = new Error('Profile was not found.')
    err.statusCode = 404
    throw err
  }
  if (/This account is private/i.test(text) && /Follow to see/i.test(text)) {
    const err = new Error('Cannot view this profile with your account.')
    err.statusCode = 403
    throw err
  }
}

async function extractProfileMetadata(page, username) {
  const shared = await page.evaluate(() => {
    const json = document.querySelector('script[type="application/ld+json"]')
    if (json?.textContent) {
      try {
        return JSON.parse(json.textContent)
      } catch {
        return null
      }
    }
    return window._sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user ?? null
  })

  if (shared?.mainEntityofPage || shared?.['@type'] === 'ProfilePage') {
    return {
      username,
      fullName: shared.name ?? '',
      biography: shared.description ?? '',
      profilePicUrl: shared.image ?? null,
    }
  }

  if (shared?.username) {
    return parseProfileFromSharedData(shared)
  }

  return {
    username,
    fullName: (await page.locator('header h2, header h1').first().textContent().catch(() => ''))?.trim() ?? '',
    biography: (await page.locator('header section').nth(1).textContent().catch(() => ''))?.trim() ?? '',
  }
}

async function collectPostsFromDom(page, username) {
  const hrefs = await page.locator('a[href*="/p/"], a[href*="/reel/"]').evaluateAll((anchors) =>
    anchors.map((a) => a.href).filter(Boolean),
  )

  return hrefs.map((href) => {
    const match = href.match(/\/(p|reel)\/([^/]+)/)
    if (!match) return null
    const shortCode = match[2]
    return {
      shortCode,
      url: href,
      ownerUsername: username,
      isVideo: match[1] === 'reel',
    }
  }).filter(Boolean)
}

function dedupeByShortCode(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = item.shortCode ?? item.url
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add server/playwright/scrapeProfile.js
git commit -m "feat: add Playwright profile and feed scraper"
```

---

### Task 7: Private scrape orchestrator

**Files:**
- Create: `server/privateScrape.js`
- Create: `server/playwright/mutex.js`

- [ ] **Step 1: Implement mutex**

Create `server/playwright/mutex.js`:

```javascript
let locked = false

export async function withPlaywrightMutex(fn) {
  if (locked) {
    const err = new Error('Another Instagram scrape is already running. Try again shortly.')
    err.statusCode = 429
    throw err
  }
  locked = true
  try {
    return await fn()
  } finally {
    locked = false
  }
}
```

- [ ] **Step 2: Implement privateScrape.js**

Create `server/privateScrape.js`:

```javascript
import { launchBrowser, createAuthenticatedContext } from './playwright/browser.js'
import { scrapeProfile } from './playwright/scrapeProfile.js'
import { withPlaywrightMutex } from './playwright/mutex.js'
import { getDataDir } from './sessionStore.js'

const JOB_TIMEOUT_MS = 5 * 60 * 1000

export function validatePrivateScrapeInput(body) {
  const directUrls = normalizeUrls(body.directUrls)
  if (directUrls.length === 0) {
    return { error: 'Provide at least one Instagram profile URL.' }
  }

  const usernames = directUrls.map(extractUsername).filter(Boolean)
  if (usernames.length !== directUrls.length) {
    return { error: 'Private scrapes need profile URLs like instagram.com/username/.' }
  }

  const resultsType = body.resultsType ?? 'posts'
  if (resultsType !== 'posts' && resultsType !== 'details') {
    return { error: 'Private scrapes support resultsType posts or details only.' }
  }

  return {
    input: {
      usernames,
      resultsType,
      resultsLimit: body.resultsLimit ?? 10,
    },
  }
}

export async function runPrivateScrape(input) {
  return withPlaywrightMutex(async () => {
    const browser = await launchBrowser()
    const dataDir = getDataDir()

    try {
      const context = await createAuthenticatedContext(browser, dataDir)
      const page = await context.newPage()
      const items = []

      const timeout = setTimeout(() => {
        throw new Error('Scrape timed out after 5 minutes.')
      }, JOB_TIMEOUT_MS)

      try {
        for (const username of input.usernames) {
          const scraped = await scrapeProfile(page, username, {
            resultsType: input.resultsType,
            resultsLimit: input.resultsLimit,
          })
          items.push(...scraped)
        }
      } finally {
        clearTimeout(timeout)
        await context.close()
      }

      return {
        runId: null,
        datasetId: null,
        datasetUrl: null,
        status: 'SUCCEEDED',
        itemCount: items.length,
        truncated: false,
        items,
        source: 'playwright',
      }
    } finally {
      await browser.close()
    }
  })
}

function normalizeUrls(urls) {
  const list = Array.isArray(urls) ? urls : [urls]
  return list
    .flatMap((entry) => String(entry).split('\n'))
    .map((url) => url.trim())
    .filter(Boolean)
}

function extractUsername(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const first = parts[0]
    if (['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(first)) {
      return null
    }
    return first.replace(/^@/, '')
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/privateScrape.js server/playwright/mutex.js
git commit -m "feat: add private scrape orchestrator with job mutex"
```

---

### Task 8: Scrape routing

**Files:**
- Modify: `server/scrape.js`

- [ ] **Step 1: Update routing logic**

In `server/scrape.js`:

1. Import `hasSession` from `./sessionStore.js`
2. Import `validatePrivateScrapeInput`, `runPrivateScrape` from `./privateScrape.js`
3. Replace `useAuthenticatedScrape` block for profile posts/details with Playwright when `hasSession()`:

```javascript
import { hasSession } from './sessionStore.js'
import { validatePrivateScrapeInput, runPrivateScrape } from './privateScrape.js'

function isProfileUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const first = parts[0]
    return first && !['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(first)
  } catch {
    return false
  }
}

function shouldUsePlaywright(body) {
  if (body.mode === 'connections' || body.mode === 'search') return false
  if (!hasSession()) return false
  const resultsType = body.resultsType ?? 'posts'
  if (resultsType !== 'posts' && resultsType !== 'details') return false
  const urls = normalizeUrls(body.directUrls)
  return urls.length > 0 && urls.every(isProfileUrl)
}

export function validateScrapeInput(body) {
  // ...existing guard...

  if (shouldUsePlaywright(body)) {
    return validatePrivateScrapeInput(body)
  }

  const useRestConnections =
    body.mode === 'connections' ||
    (body.instagramSession && body.mode !== 'search' && (body.resultsType ?? 'posts') === 'details')

  if (useRestConnections) {
    return validateAuthenticatedInput(body)
  }

  // ...existing Apify validation...
}

export async function runInstagramScrape(input, session) {
  if (input.usernames) {
    return runPrivateScrape(input)
  }
  if (session) {
    return runAuthenticatedScrape(session, input)
  }
  // ...existing Apify...
}
```

Adjust `validatePrivateScrapeInput` return to `{ input: { usernames, ... } }` and `runInstagramScrape` to check `input.usernames`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

- [ ] **Step 3: Commit**

```bash
git add server/scrape.js
git commit -m "feat: route profile scrapes to Playwright when session exists"
```

---

### Task 9: Dev login script

**Files:**
- Create: `scripts/ig-login.js`

- [ ] **Step 1: Implement ig-login**

Create `scripts/ig-login.js`:

```javascript
import 'dotenv/config'
import { chromium } from 'playwright'
import { writeStorageState, getStorageStatePath } from '../server/sessionStore.js'

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

console.log('Log in to Instagram in the opened browser window.')
await page.goto('https://www.instagram.com/accounts/login/')

await page.waitForFunction(
  () => document.cookie.includes('sessionid='),
  { timeout: 300_000 },
)

const state = await context.storageState()
await writeStorageState(state)
console.log(`Saved session to ${getStorageStatePath()}`)

await browser.close()
```

- [ ] **Step 2: Manual test**

Run: `npm run ig:login`
Expected: Browser opens; after login, `data/storageState.json` created

- [ ] **Step 3: Commit**

```bash
git add scripts/ig-login.js
git commit -m "feat: add headed Instagram login script for storageState bootstrap"
```

---

### Task 10: Instagram status and admin upload API

**Files:**
- Modify: `server/app.js`
- Modify: `server/scrape.js` (add `getInstagramStatus` helper or inline in app)

- [ ] **Step 1: Add endpoints to app.js**

```javascript
import { hasSession, readStorageState, writeStorageState, storageStateToCookieMap } from './sessionStore.js'
import { fetchCurrentUser } from './instagramApi.js'

function requireAdmin(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized.' })
    return false
  }
  return true
}

app.get('/api/instagram/status', async (_req, res) => {
  if (!hasSession()) {
    return res.json({ connected: false })
  }
  try {
    const state = await readStorageState()
    const cookies = storageStateToCookieMap(state)
    const user = await fetchCurrentUser({
      cookies,
      userAgent: process.env.PLAYWRIGHT_USER_AGENT || _req.headers['user-agent'] || '',
    })
    res.json({ connected: true, user })
  } catch {
    res.json({ connected: false, expired: true })
  }
})

app.post('/api/instagram/session/upload', async (req, res) => {
  if (!requireAdmin(req, res)) return
  const state = req.body?.storageState
  if (!state?.cookies) {
    return res.status(400).json({ error: 'Body must include storageState JSON with cookies.' })
  }
  await writeStorageState(state)
  res.json({ ok: true })
})
```

- [ ] **Step 2: Commit**

```bash
git add server/app.js
git commit -m "feat: add Instagram session status and admin upload endpoints"
```

---

### Task 11: Frontend — server session status

**Files:**
- Modify: `src/InstagramAuth.jsx`
- Modify: `src/api/instagramAuth.js`
- Modify: `src/App.jsx`
- Modify: `src/ScrapeForm.jsx`

- [ ] **Step 1: Replace cookie paste with status polling**

`src/api/instagramAuth.js`:

```javascript
export async function fetchInstagramStatus() {
  const res = await fetch('/api/instagram/status')
  const data = await res.json().catch(() => ({}))
  return data
}
```

- [ ] **Step 2: Simplify InstagramAuth.jsx**

- On mount: `fetchInstagramStatus()` → show Connected `@username` or disconnected
- Remove Cookie-Editor textarea and quick fields
- Show dev instructions:
  - Run `npm run ig:login` locally, or
  - Upload `storageState.json` via admin endpoint
- Remove `sessionStorage` cookie jar usage from connect flow

- [ ] **Step 3: Update App.jsx**

- Remove `instagramSession` from scrape payload (server uses disk session)
- `instagramConnected` derived from `fetchInstagramStatus().connected`

- [ ] **Step 4: Update ScrapeForm hint**

- When connected: "Profile URLs use Playwright for private posts/details"

- [ ] **Step 5: Run build**

Run: `npm run build && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add src/InstagramAuth.jsx src/api/instagramAuth.js src/App.jsx src/ScrapeForm.jsx
git commit -m "feat: switch Instagram auth UI to server storageState status"
```

---

### Task 12: Docker and Railway deployment

**Files:**
- Create: `Dockerfile`
- Modify: `README.md`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.51.0-jammy

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV PLAYWRIGHT_HEADLESS=true
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 3001
CMD ["npm", "start"]
```

- [ ] **Step 2: Document Railway deploy in README**

Add section: mount volume at `/data`, set `APIFY_TOKEN`, `ADMIN_SECRET`, run `ig:login` locally and upload storageState for bootstrap.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile README.md
git commit -m "chore: add Playwright Docker image and Railway deploy notes"
```

---

### Task 13: Manual acceptance (required before done)

- [ ] **Step 1:** `npm run ig:login` → `data/storageState.json` exists
- [ ] **Step 2:** `npm run dev` → status shows Connected
- [ ] **Step 3:** Scrape private followed profile, `details` → metadata in results
- [ ] **Step 4:** Same profile, `posts` → post URLs/captions returned, `source: playwright`
- [ ] **Step 5:** Public profile without session path still hits Apify (disconnect session file temporarily)
- [ ] **Step 6:** `npm test && npm run lint && npm run build` all pass

---

## Phase 2 (deferred — not in this plan's tasks)

- `POST /api/instagram/login/start` + live browser URL (Browserbase)
- `GET /api/instagram/login/:id/status`
- Remove legacy REST cookie connect flow entirely

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Playwright private posts/details | 6, 7, 8 |
| storageState on disk | 2, 9, 10 |
| Dev bootstrap login | 9 |
| Apify for public | 8 (unchanged path) |
| REST connections v1 | 8 (kept) |
| Mutex single job | 7 |
| Human-like scroll | 4, 6 |
| Docker Railway | 12 |
| UI connect status | 11 |
| Unit tests parsers/store | 2, 3, 4 |
| Admin upload | 10 |

---

## Self-review notes

- All spec v1 requirements mapped to tasks 1–13.
- No TBD placeholders in task steps.
- Prod live login explicitly deferred to Phase 2 per spec sequencing.
- `validatePrivateScrapeInput` return shape aligned with `runInstagramScrape` `input.usernames` check.
