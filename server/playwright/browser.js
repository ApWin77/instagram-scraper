import { chromium } from 'playwright'
import { getStorageStatePath, hasSession, resolveSessionUserAgent } from '../sessionStore.js'

const VIEWPORT = { width: 1280, height: 900 }

export async function launchBrowser() {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false'
  return chromium.launch({ headless })
}

export async function createAuthenticatedContext(browser, dataDir) {
  if (!hasSession(dataDir)) {
    const err = new Error('Connect Instagram first.')
    err.statusCode = 401
    throw err
  }

  const userAgent = await resolveSessionUserAgent(dataDir)

  return browser.newContext({
    storageState: getStorageStatePath(dataDir),
    viewport: VIEWPORT,
    locale: 'en-US',
    userAgent,
  })
}
