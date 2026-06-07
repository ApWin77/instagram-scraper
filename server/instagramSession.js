import {
  cookiesToSession,
  parseInstagramCookies,
  resolveInstagramSession,
  sessionToCookies,
} from '../src/lib/instagramCookies.js'

export {
  parseInstagramCookies,
  cookiesToSession,
  resolveInstagramSession,
  sessionToCookies,
}

export function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}
