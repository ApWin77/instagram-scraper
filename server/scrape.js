import { ApifyClient } from 'apify-client'
import {
  runAuthenticatedScrape,
  validateAuthenticatedInput,
} from './authenticatedScrape.js'
import { cookiesToSession, resolveInstagramSession } from './instagramSession.js'
import { fetchCurrentUser } from './instagramApi.js'
import { logError, logInfo } from './logger.js'
import {
  hasSession,
  readStorageState,
  resolveSessionUserAgent,
  storageStateToCookieMap,
} from './sessionStore.js'
import { validatePrivateScrapeInput, runPrivateScrape } from './privateScrape.js'

const ACTOR_ID = 'apify/instagram-scraper'
const RESULTS_TYPES = ['posts', 'details', 'comments', 'reels', 'mentions', 'stories']
const SEARCH_TYPES = ['hashtag', 'profile', 'place', 'user']
const DATASET_FETCH_LIMIT = 1000

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

export async function validateScrapeInput(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object.' }
  }

  if (shouldUsePlaywright(body)) {
    return validatePrivateScrapeInput(body)
  }

  const useRestConnections =
    body.mode === 'connections' ||
    (body.instagramSession && body.mode !== 'search' && (body.resultsType ?? 'posts') === 'details')

  if (useRestConnections) {
    let bodyForAuth = body
    if (body.mode === 'connections' && hasSession() && !body.instagramSession) {
      const state = await readStorageState()
      const cookies = storageStateToCookieMap(state)
      const userAgent = await resolveSessionUserAgent()
      bodyForAuth = {
        ...body,
        instagramSession: { cookieJar: cookies },
        userAgent,
      }
    }
    return validateAuthenticatedInput(bodyForAuth)
  }

  const directUrls = normalizeUrls(body.directUrls)
  const search = typeof body.search === 'string' ? body.search.trim() : ''

  if (directUrls.length === 0 && !search) {
    return { error: 'Provide at least one Instagram URL or a search query.' }
  }

  const resultsType = body.resultsType ?? 'posts'
  if (!RESULTS_TYPES.includes(resultsType)) {
    return {
      error: `resultsType must be one of: ${RESULTS_TYPES.join(', ')}.`,
    }
  }

  if (search) {
    const searchType = body.searchType ?? 'hashtag'
    if (!SEARCH_TYPES.includes(searchType)) {
      return {
        error: `searchType must be one of: ${SEARCH_TYPES.join(', ')}.`,
      }
    }
  }

  const input = buildActorInput(body, directUrls, search)
  return { input }
}

function normalizeUrls(urls) {
  if (!urls) return []
  const list = Array.isArray(urls) ? urls : [urls]
  return list
    .flatMap((entry) => String(entry).split('\n'))
    .map((url) => url.trim())
    .filter(Boolean)
}

function buildActorInput(body, directUrls, search) {
  const input = {
    resultsType: body.resultsType ?? 'posts',
    addParentData: Boolean(body.addParentData),
  }

  if (directUrls.length > 0) {
    input.directUrls = directUrls
  }

  if (search) {
    input.search = search
    input.searchType = body.searchType ?? 'hashtag'
    if (body.searchLimit != null && body.searchLimit !== '') {
      input.searchLimit = Number(body.searchLimit)
    }
  }

  if (body.resultsLimit != null && body.resultsLimit !== '') {
    input.resultsLimit = Number(body.resultsLimit)
  }

  const newerThan =
    typeof body.onlyPostsNewerThan === 'string'
      ? body.onlyPostsNewerThan.trim()
      : ''
  if (newerThan) {
    input.onlyPostsNewerThan = newerThan
  }

  return input
}

export async function validateInstagramSession(sessionInput, userAgent) {
  const resolved = resolveInstagramSession(sessionInput, userAgent)
  if (resolved.error) {
    logError('instagram/session', 'Session resolve failed', {
      error: resolved.error,
    })
    return { error: resolved.error }
  }

  const { session } = resolved

  try {
    logInfo('instagram/session', 'Validating session', {
      cookieCount: Object.keys(session.cookies).length,
      cookieNames: Object.keys(session.cookies),
      userAgent: session.userAgent,
    })
    const user = await fetchCurrentUser(session)
    return {
      user,
      session,
      instagramSession: cookiesToSession(session.cookies, session.userAgent),
    }
  } catch (err) {
    logError('instagram/session', err.message ?? 'Instagram session is invalid', {
      cookieCount: Object.keys(session.cookies).length,
      cookieNames: Object.keys(session.cookies),
      userAgent: session.userAgent,
      stack: err.stack,
    })
    return { error: err.message ?? 'Instagram session is invalid.' }
  }
}

export async function runInstagramScrape(input, session) {
  if (input.usernames) {
    return runPrivateScrape(input)
  }
  if (session) {
    return runAuthenticatedScrape(session, input)
  }

  const token = process.env.APIFY_TOKEN
  if (!token) {
    const err = new Error(
      'APIFY_TOKEN is not set. Copy .env.example to .env and add your Apify API token.',
    )
    err.statusCode = 500
    throw err
  }

  const client = new ApifyClient({ token })
  const run = await client.actor(ACTOR_ID).call(input)

  const { items, total } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: DATASET_FETCH_LIMIT })

  const itemCount = total ?? items.length
  const truncated = itemCount > items.length

  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
    datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
    status: run.status,
    itemCount,
    truncated,
    items,
  }
}
