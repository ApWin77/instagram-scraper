export function clampLimit(limit, max = 50) {
  const n = Number(limit)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, max)
}

export function randomDelayMs(min = 1500, max = 4000) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function scrollPage(page, pixels = 600) {
  await page.evaluate((y) => window.scrollBy(0, y), pixels)
}
