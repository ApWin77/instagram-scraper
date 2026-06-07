const STORAGE_KEY = 'instagram-scraper:session'

export function loadInstagramSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveInstagramSession(session, user) {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      instagramSession: session,
      user,
      connectedAt: new Date().toISOString(),
    }),
  )
}

export function clearInstagramSession() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function getStoredSessionPayload() {
  const data = loadInstagramSession()
  return data?.instagramSession ?? null
}
