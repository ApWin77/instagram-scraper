import { ApifyClient } from 'apify-client'

const ACTOR_ID = 'apify/instagram-scraper'
const RESULTS_TYPES = ['posts', 'details', 'comments', 'reels', 'mentions', 'stories']
const SEARCH_TYPES = ['hashtag', 'profile', 'place', 'user']
const DATASET_FETCH_LIMIT = 1000

export function validateScrapeInput(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object.' }
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

export async function runInstagramScrape(input) {
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
