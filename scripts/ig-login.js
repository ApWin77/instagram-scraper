import 'dotenv/config'
import { chromium } from 'playwright'
import { writeStorageState, getStorageStatePath } from '../server/sessionStore.js'

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

console.log('Log in to Instagram in the opened browser window.')
await page.goto('https://www.instagram.com/accounts/login/')

await page.waitForFunction(
  () => document.cookie.includes('sessionid='),
  { timeout: 300_000 },
)

const state = await context.storageState()
await writeStorageState(state)
console.log(`Saved session to ${getStorageStatePath()}`)

await browser.close()
