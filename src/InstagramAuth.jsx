import { useEffect, useState } from 'react'
import { fetchInstagramStatus } from './api/instagramAuth.js'

const POLL_MS = 10_000

export default function InstagramAuth({ onStatusChange }) {
  const [status, setStatus] = useState({ connected: false, loading: true })
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const data = await fetchInstagramStatus()
        if (cancelled) return
        setStatus({ ...data, loading: false })
        setError(null)
        onStatusChange?.(Boolean(data.connected), data.user ?? null)
      } catch (err) {
        if (cancelled) return
        setStatus({ connected: false, loading: false })
        setError(err.message ?? 'Could not check Instagram status.')
        onStatusChange?.(false, null)
      }
    }

    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [onStatusChange])

  const { connected, user, expired, loading } = status

  return (
    <section className="instagram-auth" aria-labelledby="instagram-auth-title">
      <div className="instagram-auth-header">
        <div>
          <h2 id="instagram-auth-title">Instagram account</h2>
          <p>
            Connect your account on the server to scrape private profiles you can see and export
            following or followers lists.
          </p>
        </div>
        {!loading && connected && (
          <span className="auth-badge connected" title="Connected">
            Connected
          </span>
        )}
      </div>

      {loading ? (
        <p className="auth-note">Checking Instagram session…</p>
      ) : connected && user ? (
        <div className="auth-connected">
          <p>
            Signed in as <strong>@{user.username}</strong>
            {user.fullName ? ` (${user.fullName})` : ''}
          </p>
        </div>
      ) : (
        <div className="auth-disconnected">
          <p>
            {expired
              ? 'Server session expired — log in again and upload a fresh storageState.'
              : 'No Instagram session on the server yet.'}
          </p>
        </div>
      )}

      <div className="auth-connect-form">
        <p className="auth-steps-title">
          <strong>Development:</strong> bootstrap a session locally
        </p>
        <ol className="auth-steps">
          <li>
            Run <code>npm run ig:login</code> — a browser opens; log in to Instagram.
          </li>
          <li>
            After login, the app saves <code>data/storageState.json</code> on the server machine.
          </li>
          <li>Restart or refresh — status above should show Connected.</li>
        </ol>

        <p className="auth-steps-title">
          <strong>Production (Railway):</strong> upload session to the server
        </p>
        <ol className="auth-steps">
          <li>Run <code>npm run ig:login</code> locally to create <code>data/storageState.json</code>.</li>
          <li>
            POST the file to <code>/api/instagram/session/upload</code> with header{' '}
            <code>x-admin-secret: YOUR_ADMIN_SECRET</code> and body{' '}
            <code>{'{"storageState": <file contents>}'}</code>.
          </li>
        </ol>
      </div>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}
    </section>
  )
}
