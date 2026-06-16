import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

let dataDir
let store

afterEach(async () => {
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

test('hasSession returns false when file missing', async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ig-session-'))
  store = await import('../../server/sessionStore.js')
  assert.equal(store.hasSession(dataDir), false)
})

test('hasSession returns true when storageState exists', async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ig-session-'))
  store = await import('../../server/sessionStore.js')
  await writeFile(join(dataDir, 'storageState.json'), '{"cookies":[]}')
  assert.equal(store.hasSession(dataDir), true)
})

test('getStorageStatePath joins DATA_DIR', async () => {
  store = await import('../../server/sessionStore.js')
  assert.equal(
    store.getStorageStatePath('/tmp/data'),
    '/tmp/data/storageState.json',
  )
})
