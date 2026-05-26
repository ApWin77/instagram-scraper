import { useState } from 'react'
import { runScrape } from './api/scrape.js'
import CachePrompt from './CachePrompt.jsx'
import { getCachedScrape, saveCachedScrape } from './lib/scrapeCache.js'
import ScrapeForm from './ScrapeForm.jsx'
import ResultsView from './ResultsView.jsx'
import './App.css'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [cachePrompt, setCachePrompt] = useState(null)

  async function executeScrape(input, { fromCache = false } = {}) {
    setLoading(true)
    setError(null)
    if (!fromCache) setResult(null)

    try {
      const data = await runScrape(input)
      setResult(data)
      saveCachedScrape(input, data)
      setCachePrompt(null)
    } catch (err) {
      setError(err.message ?? 'Scrape failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(input) {
    setError(null)
    setCachePrompt(null)

    const cached = getCachedScrape(input)
    if (cached) {
      setCachePrompt({ input, cached })
      setResult(null)
      return
    }

    executeScrape(input)
  }

  function handleUseCached() {
    setResult(cachePrompt.cached.result)
    setCachePrompt(null)
    setError(null)
  }

  function handleRescrape() {
    const { input } = cachePrompt
    setCachePrompt(null)
    executeScrape(input)
  }

  return (
    <div className="app">
      <header>
        <h1>Instagram Scraper</h1>
        <p>
          Powered by{' '}
          <a
            href="https://apify.com/apify/instagram-scraper"
            target="_blank"
            rel="noreferrer"
          >
            apify/instagram-scraper
          </a>
        </p>
      </header>

      <ScrapeForm onSubmit={handleSubmit} loading={loading} />

      {cachePrompt && !loading && (
        <CachePrompt
          cached={cachePrompt.cached}
          onUseCached={handleUseCached}
          onRescrape={handleRescrape}
        />
      )}

      {loading && (
        <p className="status loading-msg">
          Running Actor on Apify… this may take a minute.
        </p>
      )}

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <ResultsView result={result} />
    </div>
  )
}

export default App
