let locked = false

export async function withPlaywrightMutex(fn) {
  if (locked) {
    const err = new Error('Another Instagram scrape is already running. Try again shortly.')
    err.statusCode = 429
    throw err
  }
  locked = true
  try {
    return await fn()
  } finally {
    locked = false
  }
}
