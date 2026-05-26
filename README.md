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

Results appear after the Actor run finishes. Use **Download JSON** to export the dataset items. A link to the Apify dataset is shown for each run.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server and Vite dev server |
| `npm run dev:server` | API only (port 3001) |
| `npm run dev:client` | Vite only |
| `npm run build` | Production frontend build |
| `npm run start:server` | Run API in production (set `APIFY_TOKEN` in env) |

## Cost and legal notes

This Actor is [paid per result](https://apify.com/apify/instagram-scraper). Keep `resultsLimit` low while testing. Scraping public Instagram data may be subject to Instagram’s terms and applicable privacy laws; use responsibly.
