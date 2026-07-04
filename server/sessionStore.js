import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const DEFAULT_DATA_DIR = 'data'
const STORAGE_FILE = 'storageState.json'
const META_FILE = 'sessionMeta.json'

let cachedDefaultUserAgent

export function getDataDir(override) {
  return override ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR
}

export function getStorageStatePath(dataDir = getDataDir()) {
  return join(dataDir, STORAGE_FILE)
}

export function getSessionMetaPath(dataDir = getDataDir()) {
  return join(dataDir, META_FILE)
}

export function hasSession(dataDir = getDataDir()) {
  return existsSync(getStorageStatePath(dataDir))
}

export async function readStorageState(dataDir = getDataDir()) {
  const path = getStorageStatePath(dataDir)
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw)
}

export async function writeStorageState(state, dataDir = getDataDir()) {
  const path = getStorageStatePath(dataDir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), 'utf8')
}

export function storageStateToCookieMap(state) {
  const map = {}
  for (const cookie of state.cookies ?? []) {
    if (cookie.name && cookie.value != null) {
      map[cookie.name] = String(cookie.value)
    }
  }
  return map
}

export function hasInstagramSessionCookies(state) {
  const names = new Set((state.cookies ?? []).map((cookie) => cookie.name))
  return names.has('sessionid') && names.has('ds_user_id')
}

export async function readSessionMeta(dataDir = getDataDir()) {
  const raw = await readFile(getSessionMetaPath(dataDir), 'utf8')
  return JSON.parse(raw)
}

export async function writeSessionMeta(meta, dataDir = getDataDir()) {
  const path = getSessionMetaPath(dataDir)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(meta, null, 2), 'utf8')
}

export async function getPlaywrightDefaultUserAgent() {
  if (process.env.PLAYWRIGHT_USER_AGENT) {
    return process.env.PLAYWRIGHT_USER_AGENT
  }
  if (cachedDefaultUserAgent) {
    return cachedDefaultUserAgent
  }

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    cachedDefaultUserAgent = await page.evaluate(() => navigator.userAgent)
    return cachedDefaultUserAgent
  } finally {
    await browser.close()
  }
}

export async function resolveSessionUserAgent(dataDir = getDataDir()) {
  if (process.env.PLAYWRIGHT_USER_AGENT) {
    return process.env.PLAYWRIGHT_USER_AGENT
  }

  try {
    const meta = await readSessionMeta(dataDir)
    if (typeof meta.userAgent === 'string' && meta.userAgent.trim()) {
      return meta.userAgent.trim()
    }
  } catch {
    // sessionMeta.json is optional for older sessions
  }

  return getPlaywrightDefaultUserAgent()
}
