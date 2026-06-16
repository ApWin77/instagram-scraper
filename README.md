# Instagram Scraper

A local React app that runs the [Apify Instagram Scraper](https://apify.com/apify/instagram-scraper) actor and displays results in the browser.

## Setup

1. Copy the environment file and add your [Apify API token](https://console.apify.com/account/integrations):

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `APIFY_TOKEN=your_token_here`.

2. Install dependencies and start dev servers (API + Vite):

   ```bash
   npm install
   npm run dev
   ```

3. Open the URL shown by Vite (usually `http://localhost:5173`).

## Usage

- **URLs mode:** paste one or more Instagram URLs (profile, post `/p/`, reel, etc.) and choose what to scrape (posts, profile details, comments, etc.).
- **Search mode:** enter a hashtag, profile, or place search query with a search type and limits.
- **Connections mode (Instagram connected):** export your **following** or **followers** list, including private accounts your session can see.

### Connect Instagram (private profiles & connections)

Instagram does not offer an official OAuth scope for follower/following lists or other users’ private profiles. This app stores a **Playwright `storageState` session on the server** (not in your browser):

**Development**

1. Run `npm run ig:login` — a headed browser opens; log in to Instagram.
2. The script saves `data/storageState.json` locally.
3. Start the app (`npm run dev`) — the UI polls `/api/instagram/status` and shows Connected.

**Production (Railway / Docker)**

1. Mount a persistent volume at `/data` (maps to `DATA_DIR`).
2. Set environment variables: `APIFY_TOKEN`, `ADMIN_SECRET`, optionally `PLAYWRIGHT_USER_AGENT`.
3. Bootstrap the session: run `npm run ig:login` locally, then upload `data/storageState.json`:

   ```bash
   curl -X POST https://your-app.railway.app/api/instagram/session/upload \
     -H "Content-Type: application/json" \
     -H "x-admin-secret: YOUR_ADMIN_SECRET" \
     -d "{\"storageState\": $(cat data/storageState.json)}"
   ```

With a connected server session:

- **Connections** tab: export following/followers (yours or another username you can view).
- **Direct URLs** + content type **posts** or **details**: Playwright scrapes private profiles your account can see.

Public scrapes without a server session still use the Apify Actor as before.

Results appear after the run finishes. Use **Download JSON** to export items.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server and Vite dev server |
| `npm run dev:server` | API only (port 3001) |
| `npm run dev:client` | Vite only |
| `npm run build` | Production frontend build |
| `npm start` | Run production server (API + built UI) |
| `npm run test` | Run server unit tests |
| `npm run ig:login` | Headed browser login → save `data/storageState.json` |

## Deploying on Vercel

1. Push the repo to GitHub and [import it in Vercel](https://vercel.com/new).
2. Vercel reads `vercel.json` automatically:
   - **Build:** `npm run build` → static files in `dist/`
   - **API:** `api/index.js` (Express) handles `/api/*`
3. In the Vercel project → **Settings → Environment Variables**, add:
   - `APIFY_TOKEN` = your Apify token (all environments you use)
4. Deploy.

Or from the CLI:

```bash
npm i -g vercel
vercel
vercel env add APIFY_TOKEN
vercel --prod
```

**Check:** open `https://<your-project>.vercel.app/api/health` — expect `{"ok":true,"hasToken":true}`.

**Timeouts:** Scraping waits for the Apify Actor to finish. That can take minutes. `vercel.json` sets `maxDuration: 300` (5 minutes), which needs a **Vercel Pro** plan. On the Hobby plan the limit is **10 seconds**, so long scrapes will fail with a timeout — use a VPS/Railway/Render with `npm start` instead, or upgrade Vercel.

Do **not** set a custom “Output Directory” in the Vercel UI if it conflicts with `vercel.json`; the repo config already points to `dist`.

## Deploying (VPS, Railway, Render, etc.)

This app needs **one Node process** that serves both the React UI and `/api/*`. Static-only hosting (GitHub Pages, S3 without a proxy) will return **404** on scrape requests because there is no API.

On the remote machine:

```bash
git clone <your-repo>
cd instagram-scraper
npm ci
npm run build
export APIFY_TOKEN=your_token_here
export PORT=3001   # optional; platform often sets PORT automatically
npm start
```

Set `APIFY_TOKEN` in your host’s environment variables (not only in a local `.env` file unless you copy it to the server).

**Platform settings (typical):**

| Setting | Value |
|---------|--------|
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Port | Use the platform’s `PORT` (the server reads `process.env.PORT`) |

**Health check:** `GET /api/health` should return `{"ok":true,"hasToken":true}` when the token is set.

| `npm run start:server` | Same as `npm start` |

## Deploying on Railway (Playwright)

This app needs **Playwright + Chromium** and a **persistent volume** for the Instagram session. Railway with Docker is the recommended production host.

1. Connect the repo to [Railway](https://railway.app/) and deploy using the included `Dockerfile`.
2. Add a **volume** mounted at `/data` (this is where `storageState.json` lives via `DATA_DIR=/data`).
3. Set environment variables:

   | Variable | Purpose |
   |---------|---------|
   | `APIFY_TOKEN` | Apify API token (public scrapes) |
   | `ADMIN_SECRET` | Protects `POST /api/instagram/session/upload` |
   | `PLAYWRIGHT_HEADLESS` | `true` (default in Docker) |
   | `DATA_DIR` | `/data` (default in Docker) |

4. Bootstrap Instagram session:
   - Locally: `npm run ig:login` → creates `data/storageState.json`
   - Upload to production via the admin endpoint (see **Connect Instagram** above)
5. Verify: `GET /api/instagram/status` returns `{"connected":true,"user":{...}}`.

**Note:** Playwright scrapes can take several minutes. Ensure your platform timeout allows at least 5 minutes per request.

**Process manager (PM2):**

```bash
npm run build
pm2 start server/index.js --name instagram-scraper
```

## Cost and legal notes

This Actor is [paid per result](https://apify.com/apify/instagram-scraper). Keep `resultsLimit` low while testing. Scraping public Instagram data may be subject to Instagram’s terms and applicable privacy laws; use responsibly.
