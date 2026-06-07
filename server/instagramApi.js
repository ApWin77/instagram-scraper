import { cookieHeader } from './instagramSession.js'
import { logError, logWarn } from './logger.js'

const IG_APP_ID = '936619743392459'

function instagramHeaders(session, { referer = 'https://www.instagram.com/' } = {}) {
  return {
    Cookie: cookieHeader(session.cookies),
    'X-CSRFToken': session.cookies.csrftoken,
    'X-IG-App-ID': IG_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    'X-ASBD-ID': '359341',
    'X-IG-WWW-Claim': '0',
    'User-Agent': session.userAgent,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Origin: 'https://www.instagram.com',
    Referer: referer,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  }
}

function instagramErrorMessage(data, status) {
  if (
    data.message === 'useragent mismatch' ||
    data.error_type === 'useragent mismatch'
  ) {
    return 'Instagram rejected the User-Agent. Export cookies and connect from the same browser you use on instagram.com, then click Connect without switching browsers.'
  }
  if (data.error_type === 'checkpoint_required' || data.message === 'checkpoint_required') {
    return 'Instagram requires verification. Open instagram.com in your browser, complete any security prompts, then export fresh cookies.'
  }
  if (data.error_type === 'challenge_required' || data.message === 'challenge_required') {
    return 'Instagram security challenge required. Log in on instagram.com, finish the challenge, then export fresh cookies.'
  }
  if (data.message === 'login_required' || data.require_login) {
    return 'Instagram session expired. Log in again on instagram.com and export fresh cookies.'
  }
  if (data.message) return data.message
  if (status === 401 || status === 403) {
    return 'Instagram session expired or invalid. Connect your account again.'
  }
  return `Instagram request failed (${status}).`
}

async function instagramFetch(url, session, options = {}) {
  const res = await fetch(url, { headers: instagramHeaders(session, options) })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.status === 'fail') {
    const message = instagramErrorMessage(data, res.status)
    logError('instagram/api', message, {
      url,
      status: res.status,
      instagramStatus: data.status,
      errorType: data.error_type,
      cookieCount: Object.keys(session.cookies).length,
      cookieNames: Object.keys(session.cookies),
      userAgent: session.userAgent,
    })
    const err = new Error(message)
    err.statusCode = res.status === 401 || res.status === 403 ? 401 : 502
    throw err
  }

  return data
}

async function tryInstagramFetch(urls, session) {
  let lastError = null

  for (const url of urls) {
    try {
      return await instagramFetch(url, session)
    } catch (err) {
      lastError = err
      logWarn('instagram/api', `Endpoint failed, trying next: ${url}`, {
        message: err.message,
      })
    }
  }

  throw lastError ?? new Error('Instagram request failed.')
}

export async function fetchCurrentUser(session) {
  try {
    const data = await tryInstagramFetch(
      [
        'https://www.instagram.com/api/v1/accounts/current_user/?edit=true',
        'https://i.instagram.com/api/v1/accounts/current_user/?edit=true',
      ],
      session,
    )
    if (data.user?.username) {
      return mapUser(data.user)
    }
  } catch (err) {
    if (!session.cookies.ds_user_id) throw err
    logWarn('instagram/api', 'current_user failed, trying users/{id}/info', {
      message: err.message,
    })
  }

  if (session.cookies.ds_user_id) {
    return fetchUserById(session.cookies.ds_user_id, session)
  }

  const err = new Error('Could not read your Instagram account.')
  err.statusCode = 502
  throw err
}

async function fetchUserById(userId, session) {
  const data = await instagramFetch(
    `https://www.instagram.com/api/v1/users/${userId}/info/`,
    session,
  )
  const user = data.user
  if (!user?.username) {
    const err = new Error('Could not read your Instagram account.')
    err.statusCode = 502
    throw err
  }
  return mapUser(user)
}

export async function fetchWebProfile(username, session) {
  const data = await instagramFetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    session,
  )
  const user = data.data?.user
  if (!user) {
    const err = new Error(`Profile @${username} was not found or is not visible to your account.`)
    err.statusCode = 404
    throw err
  }
  return mapUser(user)
}

export async function fetchFriendships(userId, session, { type, limit }) {
  const path = type === 'followers' ? 'followers' : 'following'
  const items = []
  let maxId = null

  while (items.length < limit) {
    const count = Math.min(50, limit - items.length)
    const params = new URLSearchParams({ count: String(count) })
    if (maxId) params.set('max_id', maxId)

    const data = await instagramFetch(
      `https://www.instagram.com/api/v1/friendships/${userId}/${path}/?${params}`,
      session,
    )

    const users = data.users ?? []
    for (const user of users) {
      items.push(mapUser(user))
      if (items.length >= limit) break
    }

    if (!data.next_max_id || users.length === 0) break
    maxId = data.next_max_id
  }

  return items
}

export async function resolveUserId(username, session) {
  const profile = await fetchWebProfile(username, session)
  return profile.id
}

function mapUser(user) {
  return {
    id: user.pk ?? user.id,
    username: user.username,
    fullName: user.full_name ?? '',
    biography: user.biography ?? '',
    followersCount: user.follower_count ?? user.followers_count ?? null,
    followsCount: user.following_count ?? user.follows_count ?? null,
    postsCount: user.media_count ?? null,
    isPrivate: Boolean(user.is_private),
    isVerified: Boolean(user.is_verified),
    profilePicUrl: user.profile_pic_url ?? user.hd_profile_pic_url_info?.url ?? null,
    externalUrl: user.external_url ?? null,
  }
}
