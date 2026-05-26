import { formatScrapedAt } from './lib/scrapeCache.js'

export default function CachePrompt({ cached, onUseCached, onRescrape }) {
  const { scrapedAt, result } = cached
  const count = result.itemCount ?? result.items?.length ?? 0

  return (
    <div className="banner cache-prompt" role="status">
      <p>
        You already scraped this query on{' '}
        <strong>{formatScrapedAt(scrapedAt)}</strong> ({count} items, run{' '}
        <code>{result.runId}</code>).
      </p>
      <div className="cache-prompt-actions">
        <button type="button" className="submit-btn" onClick={onUseCached}>
          Show previous results
        </button>
        <button type="button" className="btn-secondary" onClick={onRescrape}>
          Scrape again
        </button>
      </div>
    </div>
  )
}
