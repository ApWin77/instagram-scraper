import cors from 'cors'
import express from 'express'
import { fetchInstagramImage, isAllowedImageUrl } from './imageProxy.js'
import { logError } from './logger.js'
import {
  runInstagramScrape,
  validateInstagramSession,
  validateScrapeInput,
} from './scrape.js'

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

  app.post('/api/instagram/connect', async (req, res) => {
    const sessionInput = req.body?.instagramSession
    const inputMeta = {
      type: typeof sessionInput,
      length: typeof sessionInput === 'string' ? sessionInput.length : undefined,
      keys:
        sessionInput && typeof sessionInput === 'object' && !Array.isArray(sessionInput)
          ? Object.keys(sessionInput)
          : undefined,
    }

    try {
      const userAgent = req.body?.userAgent || req.headers['user-agent']
      const result = await validateInstagramSession(sessionInput, userAgent)
      if (result.error) {
        logError('instagram/connect', result.error, inputMeta)
        return res.status(400).json({ error: result.error })
      }

      res.json({
        ok: true,
        user: result.user,
        instagramSession: result.instagramSession,
      })
    } catch (err) {
      logError('instagram/connect', err.message ?? 'Unexpected error', {
        ...inputMeta,
        stack: err.stack,
      })
      res.status(err.statusCode ?? 500).json({
        error: err.message ?? 'Could not connect Instagram account.',
      })
    }
  })

  app.post('/api/scrape', async (req, res) => {
    const validation = validateScrapeInput(req.body)
    if (validation.error) {
      logError('scrape', validation.error, { mode: req.body?.mode })
      return res.status(400).json({ error: validation.error })
    }

    try {
      const result = await runInstagramScrape(validation.input, validation.session)
      res.json(result)
    } catch (err) {
      const status = err.statusCode ?? 500
      logError('scrape', err.message ?? 'Scrape failed', {
        status,
        mode: req.body?.mode,
        stack: err.stack,
      })
      res.status(status).json({
        error: err.message ?? 'Scrape failed.',
      })
    }
  })

  return app
}
