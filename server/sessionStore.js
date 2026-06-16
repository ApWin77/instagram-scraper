import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DEFAULT_DATA_DIR = 'data'
const STORAGE_FILE = 'storageState.json'

export function getDataDir(override) {
  return override ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR
}

export function getStorageStatePath(dataDir = getDataDir()) {
  return join(dataDir, STORAGE_FILE)
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
