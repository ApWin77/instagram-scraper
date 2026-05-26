import cors from 'cors'
import express from 'express'
import { fetchInstagramImage, isAllowedImageUrl } from './imageProxy.js'
import { runInstagramScrape, validateScrapeInput } from './scrape.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasToken: Boolean(process.env.APIFY_TOKEN),
    })
  })

  app.get('/api/image', async (req, res) => {
    const url = typeof req.query.url === 'string' ? req.query.url : ''

    if (!url || !isAllowedImageUrl(url)) {
      return res.status(400).json({ error: 'Invalid or disallowed image URL.' })
    }

    try {
      const { buffer, contentType } = await fetchInstagramImage(url)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.send(buffer)
    } catch (err) {
      res.status(err.statusCode ?? 502).json({
        error: err.message ?? 'Failed to load image.',
      })
    }
  })

  app.post('/api/scrape', async (req, res) => {
    const validation = validateScrapeInput(req.body)
    if (validation.error) {
      return res.status(400).json({ error: validation.error })
    }

    try {
      const result = await runInstagramScrape(validation.input)
      res.json(result)
    } catch (err) {
      const status = err.statusCode ?? 500
      res.status(status).json({
        error: err.message ?? 'Scrape failed.',
      })
    }
  })

  return app
}
