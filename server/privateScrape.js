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
