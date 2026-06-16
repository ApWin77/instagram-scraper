export async function fetchInstagramStatus() {
  const res = await fetch('/api/instagram/status')
  const data = await res.json().catch(() => ({}))
  return data
}
