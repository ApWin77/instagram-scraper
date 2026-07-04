import { getDataDir, readSessionMeta } from '../sessionStore.js'
import { createAuthenticatedContext, launchBrowser } from './browser.js'

const IG_APP_ID = '936619743392459'

export async function fetchLoggedInUserViaBrowser(dataDir = getDataDir()) {
  const browser = await launchBrowser()
  try {
    const context = await createAuthenticatedContext(browser, dataDir)
    const page = await context.newPage()
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' })

    const result = await page.evaluate(async (appId) => {
      const res = await fetch('/api/v1/accounts/current_user/?edit=true', {
        credentials: 'include',
        headers: {
          'X-IG-App-ID': appId,
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      const data = await res.json()
      if (data.status === 'fail') {
        return { error: data.message || data.error_type || 'fail' }
      }
      return {
        userAgent: navigator.userAgent,
        user: data.user,
      }
    }, IG_APP_ID)

    if (result.error || !result.user?.username) {
      const err = new Error(result.error || 'Could not read Instagram account.')
      err.statusCode = 401
      throw err
    }

    const meta = await readSessionMeta(dataDir).catch(() => ({}))

    return {
      userAgent: meta.userAgent || result.userAgent,
      username: result.user.username,
      fullName: result.user.full_name || null,
      id: String(result.user.pk ?? result.user.id),
    }
  } finally {
    await browser.close()
  }
}
