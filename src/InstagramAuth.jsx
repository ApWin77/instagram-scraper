import { useMemo, useState } from 'react'
import { connectInstagram } from './api/instagramAuth.js'
import { previewInstagramCookies } from './lib/instagramCookies.js'
import {
  clearInstagramSession,
  loadInstagramSession,
  saveInstagramSession,
} from './lib/instagramSession.js'

const LOGIN_URL = 'https://www.instagram.com/'

const EMPTY_FIELDS = {
  sessionId: '',
  csrfToken: '',
  dsUserId: '',
}

export default function InstagramAuth({ onSessionChange }) {
  const [stored, setStored] = useState(() => loadInstagramSession())
  const [expanded, setExpanded] = useState(!stored)
  const [inputMode, setInputMode] = useState('json')
  const [cookieJson, setCookieJson] = useState('')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const preview = useMemo(() => {
    if (inputMode === 'json') {
      if (!cookieJson.trim()) return null
      return previewInstagramCookies(cookieJson)
    }

    const hasAny = Object.values(fields).some((value) => value.trim())
    if (!hasAny) return null
    return previewInstagramCookies(fields)
  }, [cookieJson, fields, inputMode])

  function updateStored(next) {
    setStored(next)
    onSessionChange?.(next?.instagramSession ?? null, next?.user ?? null)
  }

  function openInstagramLogin() {
    window.open(LOGIN_URL, 'instagram-login', 'width=520,height=720,noopener')
    setExpanded(true)
  }

  function buildSessionPayload() {
    if (inputMode === 'json') {
      return cookieJson.trim()
    }

    return {
      sessionId: fields.sessionId.trim(),
      csrfToken: fields.csrfToken.trim(),
      dsUserId: fields.dsUserId.trim(),
    }
  }

  async function handleConnect(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = buildSessionPayload()
    const localPreview = previewInstagramCookies(payload)
    if (!localPreview.ok) {
      setError(localPreview.error)
      setLoading(false)
      return
    }

    try {
      const data = await connectInstagram(payload)
      const entry = {
        instagramSession: data.instagramSession,
        user: data.user,
        connectedAt: new Date().toISOString(),
      }
      saveInstagramSession(data.instagramSession, data.user)
      updateStored(entry)
      setCookieJson('')
      setFields(EMPTY_FIELDS)
      setExpanded(false)
    } catch (err) {
      setError(err.message ?? 'Could not connect Instagram account.')
    } finally {
      setLoading(false)
    }
  }

  function handleDisconnect() {
    clearInstagramSession()
    updateStored(null)
    setExpanded(true)
    setError(null)
  }

  return (
    <section className="instagram-auth" aria-labelledby="instagram-auth-title">
      <div className="instagram-auth-header">
        <div>
          <h2 id="instagram-auth-title">Instagram account</h2>
          <p>
            Connect your account to scrape private profiles you can see and export
            following or followers lists.
          </p>
        </div>
        {stored?.user && (
          <span className="auth-badge connected" title="Connected">
            Connected
          </span>
        )}
      </div>

      {stored?.user ? (
        <div className="auth-connected">
          <p>
            Signed in as <strong>@{stored.user.username}</strong>
            {stored.user.fullName ? ` (${stored.user.fullName})` : ''}
          </p>
          <div className="auth-connected-actions">
            <button type="button" className="auth-secondary" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Hide' : 'Reconnect'}
            </button>
            <button type="button" className="auth-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="instagram-login-btn"
          onClick={openInstagramLogin}
          disabled={loading}
        >
          Login with Instagram
        </button>
      )}

      {expanded && (
        <form className="auth-connect-form" onSubmit={handleConnect}>
          <ol className="auth-steps">
            <li>
              Open <strong>instagram.com</strong> and make sure you are logged in.
            </li>
            <li>
              Click the <strong>Cookie-Editor</strong> extension on that tab →{' '}
              <strong>Export</strong> → choose <strong>JSON</strong> (no password) → copy.
            </li>
            <li>Paste below, or switch to <strong>Quick fields</strong> and copy the three values from DevTools.</li>
          </ol>

          <div className="mode-toggle" role="group" aria-label="Cookie input mode">
            <button
              type="button"
              className={inputMode === 'json' ? 'active' : ''}
              onClick={() => setInputMode('json')}
              disabled={loading}
            >
              Paste JSON
            </button>
            <button
              type="button"
              className={inputMode === 'fields' ? 'active' : ''}
              onClick={() => setInputMode('fields')}
              disabled={loading}
            >
              Quick fields
            </button>
          </div>

          {inputMode === 'json' ? (
            <label className="field">
              <span>Cookie-Editor JSON</span>
              <textarea
                rows={6}
                value={cookieJson}
                onChange={(e) => setCookieJson(e.target.value)}
                placeholder='Paste the full JSON export from Cookie-Editor while on instagram.com'
                disabled={loading}
                spellCheck={false}
              />
            </label>
          ) : (
            <div className="auth-fields">
              <label className="field">
                <span>sessionid</span>
                <input
                  type="text"
                  value={fields.sessionId}
                  onChange={(e) => setFields((prev) => ({ ...prev, sessionId: e.target.value }))}
                  placeholder="DevTools → Application → Cookies → instagram.com"
                  disabled={loading}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>csrftoken</span>
                <input
                  type="text"
                  value={fields.csrfToken}
                  onChange={(e) => setFields((prev) => ({ ...prev, csrfToken: e.target.value }))}
                  disabled={loading}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>ds_user_id</span>
                <input
                  type="text"
                  value={fields.dsUserId}
                  onChange={(e) => setFields((prev) => ({ ...prev, dsUserId: e.target.value }))}
                  disabled={loading}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            </div>
          )}

          {preview && (
            <div
              className={`auth-preview ${preview.ok ? 'ok' : 'warn'}`}
              role="status"
            >
              {preview.ok ? (
                <p>
                  Ready to connect: sessionid, csrftoken, and ds_user_id found
                  {preview.cookieCount > 3
                    ? ` (${preview.cookieCount} cookies total — good for Instagram API)`
                    : ' (export full JSON from Cookie-Editor for best results)'}
                  .
                </p>
              ) : (
                <>
                  <p>
                    Found: {preview.found.length ? preview.found.join(', ') : 'none'}
                    {preview.missing.length > 0 && (
                      <>
                        {' '}
                        · Missing: <strong>{preview.missing.join(', ')}</strong>
                      </>
                    )}
                  </p>
                  {preview.cookieNames?.length > 0 && (
                    <p className="auth-preview-detail">
                      Parsed cookie names: {preview.cookieNames.slice(0, 10).join(', ')}
                      {preview.cookieNames.length > 10 ? '…' : ''}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="banner error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={
              loading ||
              (inputMode === 'json' ? !cookieJson.trim() : !Object.values(fields).every((v) => v.trim()))
            }
          >
            {loading ? 'Connecting…' : 'Connect account'}
          </button>

          <p className="auth-note">
            Use the <strong>same browser</strong> for instagram.com, Cookie-Editor, and this app — Instagram
            checks that your User-Agent matches the exported cookies.
          </p>
        </form>
      )}
    </section>
  )
}
