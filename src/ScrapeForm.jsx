import { useState } from 'react'

const RESULTS_TYPES = [
  'posts',
  'details',
  'comments',
  'reels',
  'mentions',
  'stories',
]

const SEARCH_TYPES = ['hashtag', 'profile', 'place', 'user']

const defaultUrls = 'https://www.instagram.com/humansofny/'

export default function ScrapeForm({ onSubmit, loading }) {
  const [mode, setMode] = useState('urls')
  const [urlsText, setUrlsText] = useState(defaultUrls)
  const [search, setSearch] = useState('#travel')
  const [searchType, setSearchType] = useState('hashtag')
  const [searchLimit, setSearchLimit] = useState(5)
  const [resultsType, setResultsType] = useState('posts')
  const [resultsLimit, setResultsLimit] = useState(10)
  const [onlyPostsNewerThan, setOnlyPostsNewerThan] = useState('')
  const [addParentData, setAddParentData] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    const payload = {
      resultsType,
      resultsLimit: Number(resultsLimit),
      addParentData,
    }

    if (onlyPostsNewerThan.trim()) {
      payload.onlyPostsNewerThan = onlyPostsNewerThan.trim()
    }

    if (mode === 'urls') {
      payload.directUrls = urlsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    } else {
      payload.search = search.trim()
      payload.searchType = searchType
      payload.searchLimit = Number(searchLimit)
    }

    onSubmit(payload)
  }

  return (
    <form className="scrape-form" onSubmit={handleSubmit}>
      <div className="mode-toggle" role="group" aria-label="Input mode">
        <button
          type="button"
          className={mode === 'urls' ? 'active' : ''}
          onClick={() => setMode('urls')}
          disabled={loading}
        >
          Direct URLs
        </button>
        <button
          type="button"
          className={mode === 'search' ? 'active' : ''}
          onClick={() => setMode('search')}
          disabled={loading}
        >
          Search
        </button>
      </div>

      {mode === 'urls' ? (
        <label className="field">
          <span>Instagram URLs (one per line)</span>
          <textarea
            rows={4}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder="https://www.instagram.com/humansofny/"
            disabled={loading}
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>Search query</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="#travel"
              disabled={loading}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Search type</span>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                disabled={loading}
              >
                {SEARCH_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Search results limit</span>
              <input
                type="number"
                min={1}
                max={250}
                value={searchLimit}
                onChange={(e) => setSearchLimit(e.target.value)}
                disabled={loading}
              />
            </label>
          </div>
        </>
      )}

      <div className="field-row">
        <label className="field">
          <span>Content to scrape</span>
          <select
            value={resultsType}
            onChange={(e) => setResultsType(e.target.value)}
            disabled={loading}
          >
            {RESULTS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Results limit per URL</span>
          <input
            type="number"
            min={1}
            value={resultsLimit}
            onChange={(e) => setResultsLimit(e.target.value)}
            disabled={loading}
          />
        </label>
      </div>

      <label className="field">
        <span>Only posts newer than (optional)</span>
        <input
          type="text"
          value={onlyPostsNewerThan}
          onChange={(e) => setOnlyPostsNewerThan(e.target.value)}
          placeholder="e.g. 1 month, 2024-01-01"
          disabled={loading}
        />
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={addParentData}
          onChange={(e) => setAddParentData(e.target.checked)}
          disabled={loading}
        />
        <span>Add parent metadata (dataSource on feed items)</span>
      </label>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Scraping…' : 'Start scrape'}
      </button>
    </form>
  )
}
