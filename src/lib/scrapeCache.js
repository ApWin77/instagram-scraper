const STORAGE_KEY = 'instagram-scraper:results'

function normalizeInput(input) {
  const directUrls = [...(input.directUrls ?? [])]
    .map((u) => String(u).trim())
    .filter(Boolean)
    .sort()

  return {
    resultsType: input.resultsType ?? 'posts',
    directUrls,
    search: (input.search ?? '').trim(),
    searchType: input.searchType ?? 'hashtag',
    searchLimit: input.searchLimit ?? null,
    resultsLimit: input.resultsLimit ?? null,
    onlyPostsNewerThan: (input.onlyPostsNewerThan ?? '').trim(),
    addParentData: Boolean(input.addParentData),
  }
}

function cacheKey(input) {
  return JSON.stringify(normalizeInput(input))
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded — drop oldest entries and retry once
    const keys = Object.keys(store).sort(
      (a, b) =>
        new Date(store[a].scrapedAt).getTime() -
        new Date(store[b].scrapedAt).getTime(),
    )
    if (keys.length > 0) delete store[keys[0]]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    } catch {
      // ignore if still failing
    }
  }
}

export function getCachedScrape(input) {
  const key = cacheKey(input)
  const entry = readStore()[key]
  if (!entry?.result) return null
  return entry
}

export function saveCachedScrape(input, result) {
  const key = cacheKey(input)
  const store = readStore()
  store[key] = {
    scrapedAt: new Date().toISOString(),
    input: normalizeInput(input),
    result,
  }
  writeStore(store)
}

export function formatScrapedAt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
