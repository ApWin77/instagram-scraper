const ALLOWED_HOSTS = [
  'cdninstagram.com',
  'fbcdn.net',
  'instagram.com',
]

export function isAllowedImageUrl(urlString) {
  try {
    const url = new URL(urlString)
    if (url.protocol !== 'https:') return false
    return ALLOWED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  } catch {
    return false
  }
}

export async function fetchInstagramImage(urlString) {
  const res = await fetch(urlString, {
    headers: {
      Referer: 'https://www.instagram.com/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!res.ok) {
    const err = new Error(`Image fetch failed (${res.status})`)
    err.statusCode = res.status === 404 ? 404 : 502
    throw err
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer = Buffer.from(await res.arrayBuffer())

  return { buffer, contentType }
}
