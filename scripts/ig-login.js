import 'dotenv/config'
import { chromium } from 'playwright'
import {
  getStorageStatePath,
  writeSessionMeta,
  writeStorageState,
} from '../server/sessionStore.js'

const IG_APP_ID = '936619743392459'

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const POLL_MS = 1000

function hasInstagramSession(cookies) {
  const names = new Set(cookies.map((cookie) => cookie.name))
  return names.has('sessionid') && names.has('ds_user_id')
}

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

console.log('Log in to Instagram in the opened browser window.')
console.log('Waiting for login (up to 5 minutes)...')

await page.goto('https://www.instagram.com/accounts/login/', {
  waitUntil: 'domcontentloaded',
})

const deadline = Date.now() + LOGIN_TIMEOUT_MS
let loggedIn = false

while (Date.now() < deadline) {
  const cookies = await context.cookies('https://www.instagram.com')
  if (hasInstagramSession(cookies)) {
    loggedIn = true
    break
  }

  await page.waitForTimeout(POLL_MS)
}

if (!loggedIn) {
  console.error(
    'Timed out waiting for login. Finish signing in (including 2FA/checkpoints), then run npm run ig:login again.',
  )
  await browser.close()
  process.exit(1)
}

await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const userAgent = await page.evaluate(() => navigator.userAgent)

let username = null
let fullName = null
try {
  const profile = await page.evaluate(async (appId) => {
    const res = await fetch('/api/v1/accounts/current_user/?edit=true', {
      credentials: 'include',
      headers: {
        'X-IG-App-ID': appId,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    const data = await res.json()
    if (data.status === 'fail') {
      throw new Error(data.message || data.error_type || 'Could not read account')
    }
    return data.user
  }, IG_APP_ID)
  username = profile?.username ?? null
  fullName = profile?.full_name || null
} catch (err) {
  console.warn('Could not read username from Instagram:', err.message)
}

const state = await context.storageState()
await writeStorageState(state)
await writeSessionMeta({
  userAgent,
  username,
  fullName,
  savedAt: new Date().toISOString(),
})
console.log(`Saved session to ${getStorageStatePath()}`)
if (username) {
  console.log(`Signed in as @${username}`)
}
console.log('Done. Run npm run dev and check that Instagram shows Connected.')

await browser.close()
