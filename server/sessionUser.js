import { fetchLoggedInUserViaBrowser } from './playwright/sessionInfo.js'
import { logWarn } from './logger.js'
import {
  readSessionMeta,
  storageStateToCookieMap,
  writeSessionMeta,
} from './sessionStore.js'

export function looksLikeUserId(value) {
  return !value || /^\d+$/.test(String(value))
}

let backfillPromise = null

async function backfillUsernameFromBrowser() {
  if (!backfillPromise) {
    backfillPromise = fetchLoggedInUserViaBrowser().finally(() => {
      backfillPromise = null
    })
  }
  return backfillPromise
}

export async function resolveConnectedUser(state) {
  const cookies = storageStateToCookieMap(state)
  const meta = await readSessionMeta().catch(() => ({}))

  if (meta.username && !looksLikeUserId(meta.username)) {
    return {
      username: meta.username,
      id: cookies.ds_user_id,
      fullName: meta.fullName ?? null,
    }
  }

  const profile = await backfillUsernameFromBrowser()

  await writeSessionMeta({
    ...meta,
    userAgent: profile.userAgent,
    username: profile.username,
    fullName: profile.fullName,
    savedAt: meta.savedAt || new Date().toISOString(),
  })

  return {
    username: profile.username,
    id: profile.id ?? cookies.ds_user_id,
    fullName: profile.fullName,
  }
}

export async function resolveConnectedUserSafe(state) {
  try {
    return await resolveConnectedUser(state)
  } catch (err) {
    logWarn('instagram/session', 'Could not resolve username for status', {
      message: err.message,
    })
    const cookies = storageStateToCookieMap(state)
    return {
      username: null,
      id: cookies.ds_user_id,
      fullName: null,
    }
  }
}
