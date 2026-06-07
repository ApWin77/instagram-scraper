const REQUIRED_COOKIES = ['sessionid', 'csrftoken', 'ds_user_id']

const COOKIE_ALIASES = {
  sessionId: 'sessionid',
  sessionid: 'sessionid',
  csrfToken: 'csrftoken',
  csrftoken: 'csrftoken',
  dsUserId: 'ds_user_id',
  ds_user_id: 'ds_user_id',
}

export function getRequiredCookieNames() {
  return [...REQUIRED_COOKIES]
}

export function parseInstagramCookies(input) {
  if (input == null) {
    return { error: 'Instagram session is required.' }
  }

  if (typeof input === 'string') {
    return parseStringInput(input.trim())
  }

  if (Array.isArray(input)) {
    return cookiesFromArray(input)
  }

  if (typeof input === 'object') {
    if (Array.isArray(input.cookies)) {
      return cookiesFromArray(input.cookies)
    }
    if (input.name && input.value != null) {
      return cookiesFromArray([input])
    }
    if (input.cookieJar && typeof input.cookieJar === 'object') {
      return cookiesFromMap({ ...input.cookieJar, ...flattenSessionObject(input) })
    }
    return cookiesFromMap(flattenSessionObject(input))
  }

  return { error: 'Invalid Instagram session format.' }
}

export function previewInstagramCookies(input) {
  const result = parseInstagramCookies(input)
  if (result.cookies) {
    const names = Object.keys(result.cookies)
    return {
      ok: true,
      found: REQUIRED_COOKIES.filter((name) => Boolean(result.cookies[name])),
      missing: [],
      cookieCount: names.length,
      cookieNames: names,
    }
  }

  const partial = result.partialMap ?? {}
  const found = REQUIRED_COOKIES.filter((name) => Boolean(partial[name]))
  const missing = REQUIRED_COOKIES.filter((name) => !partial[name])

  return {
    ok: false,
    found,
    missing,
    error: result.error,
    detectedFormat: result.detectedFormat ?? null,
    cookieNames: Object.keys(partial),
  }
}

function parseStringInput(trimmed) {
  if (!trimmed) {
    return { error: 'Instagram session is empty.' }
  }

  if (trimmed.startsWith('E2EE_') || trimmed.includes('"encrypted"')) {
    return {
      error:
        'These cookies look encrypted. In Cookie-Editor, export without a password, or use Copy → JSON while on instagram.com.',
      detectedFormat: 'encrypted',
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const result = parseInstagramCookies(parsed)
      return { ...result, detectedFormat: 'json' }
    } catch (err) {
      return {
        error: `Invalid JSON: ${err.message}`,
        detectedFormat: 'json',
      }
    }
  }

  if (trimmed.includes('\t') && trimmed.includes('instagram')) {
    const result = cookiesFromNetscape(trimmed)
    return { ...result, detectedFormat: 'netscape' }
  }

  if (trimmed.includes('=') && /sessionid|csrftoken|ds_user_id/i.test(trimmed)) {
    const result = cookiesFromHeaderString(trimmed)
    return { ...result, detectedFormat: 'header' }
  }

  return {
    ...cookiesFromMap({ sessionid: trimmed }),
    detectedFormat: 'sessionid-only',
  }
}

function flattenSessionObject(input) {
  const map = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = COOKIE_ALIASES[key] ?? (REQUIRED_COOKIES.includes(key) ? key : null)
    if (normalized && value != null && value !== '') {
      map[normalized] = String(value).trim()
    }
  }
  return map
}

function isInstagramDomain(domain) {
  if (!domain) return true
  const normalized = String(domain).toLowerCase().replace(/^\./, '')
  return normalized === 'instagram.com' || normalized.endsWith('.instagram.com')
}

function cookiesFromArray(entries) {
  const map = {}
  const instagramMap = {}

  for (const entry of entries) {
    if (!entry?.name || entry.value == null) continue
    const name = String(entry.name)
    const value = String(entry.value)
    map[name] = value
    if (isInstagramDomain(entry.domain)) {
      instagramMap[name] = value
    }
  }

  const chosen = Object.keys(instagramMap).length > 0 ? instagramMap : map
  return cookiesFromMap(chosen)
}

function cookiesFromHeaderString(text) {
  const map = {}
  const parts = text.split(/[;\n]+/)

  for (const part of parts) {
    const segment = part.trim()
    if (!segment) continue

    const eq = segment.indexOf('=')
    if (eq === -1) continue

    const name = segment.slice(0, eq).trim()
    const value = segment.slice(eq + 1).trim()
    if (name && value) {
      map[name] = value
    }
  }

  return cookiesFromMap(map)
}

function cookiesFromNetscape(text) {
  const map = {}

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const parts = trimmed.split('\t')
    if (parts.length < 7) continue

    const domain = parts[0]
    const name = parts[5]
    const value = parts[6]

    if (!isInstagramDomain(domain)) continue
    if (name && value != null) {
      map[name] = value
    }
  }

  return cookiesFromMap(map)
}

function cookiesFromMap(map) {
  const partialMap = {}
  for (const [name, value] of Object.entries(map)) {
    if (value?.trim()) partialMap[name] = value.trim()
  }

  const missing = REQUIRED_COOKIES.filter((name) => !partialMap[name])

  if (missing.length === 0) {
    return { cookies: normalizeCookieMap(partialMap) }
  }

  const foundNames = Object.keys(partialMap)
  const hints = []

  if (missing.length === REQUIRED_COOKIES.length && foundNames.length === 0) {
    hints.push('No cookies were detected in the pasted text.')
  } else if (foundNames.length > 0) {
    hints.push(`Detected cookie names: ${foundNames.slice(0, 12).join(', ')}${foundNames.length > 12 ? '…' : ''}.`)
  }

  for (const name of missing) {
    hints.push(`Missing "${name}".`)
  }

  hints.push(
    'On instagram.com: Cookie-Editor → Export → JSON (no password) → paste here. Or use the quick fields for sessionid, csrftoken, and ds_user_id.',
  )

  return {
    error: hints.join(' '),
    partialMap,
  }
}

function normalizeCookieMap(map) {
  const cookies = {}
  for (const [name, value] of Object.entries(map)) {
    if (value?.trim()) cookies[name] = value.trim()
  }
  return cookies
}

export function cookiesToSession(cookies, userAgent) {
  return {
    sessionId: cookies.sessionid,
    csrfToken: cookies.csrftoken,
    dsUserId: cookies.ds_user_id,
    cookieJar: cookies,
    userAgent: userAgent ?? null,
  }
}

export function resolveInstagramSession(sessionInput, userAgent) {
  const parsed = parseInstagramCookies(sessionInput)
  if (parsed.error) return parsed

  const storedUa =
    sessionInput &&
    typeof sessionInput === 'object' &&
    !Array.isArray(sessionInput) &&
    typeof sessionInput.userAgent === 'string'
      ? sessionInput.userAgent.trim()
      : ''

  const resolvedUa = storedUa || (typeof userAgent === 'string' ? userAgent.trim() : '')

  if (!resolvedUa) {
    return {
      error:
        'Browser User-Agent is missing. Refresh this page and connect again from the same browser you use on instagram.com.',
    }
  }

  return {
    session: {
      cookies: parsed.cookies,
      userAgent: resolvedUa,
    },
  }
}

export function sessionToCookies(session) {
  return parseInstagramCookies(session)
}
