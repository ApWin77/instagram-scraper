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
