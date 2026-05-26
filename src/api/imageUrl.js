const CDN_PATTERN =
  /^https:\/\/([^/]+\.)?(cdninstagram\.com|fbcdn\.net|instagram\.com)\//i

export function proxiedImageUrl(url) {
  if (!url || typeof url !== 'string') return null
  if (!CDN_PATTERN.test(url)) return url
  return `/api/image?url=${encodeURIComponent(url)}`
}
