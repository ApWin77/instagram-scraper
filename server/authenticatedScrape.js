import {
  fetchCurrentUser,
  fetchFriendships,
  fetchWebProfile,
  resolveUserId,
} from './instagramApi.js'
import { resolveInstagramSession } from './instagramSession.js'

const CONNECTION_TYPES = ['following', 'followers']

export function validateAuthenticatedInput(body) {
  const resolved = resolveInstagramSession(body.instagramSession, body.userAgent)
  if (resolved.error) return { error: resolved.error }

  const { session } = resolved
  const mode = body.mode ?? 'urls'

  if (mode === 'connections') {
    const connectionType = body.connectionType ?? 'following'
    if (!CONNECTION_TYPES.includes(connectionType)) {
      return { error: `connectionType must be one of: ${CONNECTION_TYPES.join(', ')}.` }
    }

    const targetUsername =
      typeof body.targetUsername === 'string' ? body.targetUsername.trim().replace(/^@/, '') : ''

    const limit = Number(body.resultsLimit ?? 50)
    if (!Number.isFinite(limit) || limit < 1 || limit > 5000) {
      return { error: 'resultsLimit must be between 1 and 5000.' }
    }

    return {
      session,
      input: { mode, connectionType, targetUsername, limit },
    }
  }

  const directUrls = normalizeUrls(body.directUrls)
  if (directUrls.length === 0) {
    return { error: 'Provide at least one Instagram profile URL.' }
  }

  const usernames = directUrls.map(extractUsername).filter(Boolean)
  if (usernames.length !== directUrls.length) {
    return { error: 'Authenticated profile scrapes need profile URLs like instagram.com/username/.' }
  }

  const resultsType = body.resultsType ?? 'details'
  if (resultsType !== 'details') {
    return {
      error: 'With Instagram connected, authenticated mode currently supports profile details only. Use Connections mode for following/followers lists.',
    }
  }

  return {
    session,
    input: { mode: 'urls', usernames, resultsType },
  }
}

export async function runAuthenticatedScrape(session, input) {
  if (input.mode === 'connections') {
    const currentUser = await fetchCurrentUser(session)
    const targetUsername = input.targetUsername || currentUser.username
    const userId =
      targetUsername === currentUser.username
        ? currentUser.id
        : await resolveUserId(targetUsername, session)

    const items = await fetchFriendships(userId, session, {
      type: input.connectionType,
      limit: input.limit,
    })

    return buildResult(items, {
      connectionType: input.connectionType,
      targetUsername,
    })
  }

  const items = []
  for (const username of input.usernames) {
    items.push(await fetchWebProfile(username, session))
  }

  return buildResult(items, { resultsType: input.resultsType })
}

function buildResult(items, meta) {
  return {
    runId: null,
    datasetId: null,
    datasetUrl: null,
    status: 'SUCCEEDED',
    itemCount: items.length,
    truncated: false,
    items,
    source: 'instagram-session',
    ...meta,
  }
}

function normalizeUrls(urls) {
  if (!urls) return []
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
    if (parts.length === 0) return null
    const first = parts[0]
    if (['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(first)) {
      return null
    }
    return first.replace(/^@/, '')
  } catch {
    return null
  }
}
