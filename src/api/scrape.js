export async function runScrape(input, instagramSession) {
  const body = instagramSession
    ? { ...input, instagramSession, userAgent: navigator.userAgent }
    : input

  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }

  return data
}
