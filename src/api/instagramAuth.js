export async function connectInstagram(instagramSession) {
  const res = await fetch('/api/instagram/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instagramSession,
      userAgent: navigator.userAgent,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error ?? `Connection failed (${res.status})`)
  }

  return data
}
