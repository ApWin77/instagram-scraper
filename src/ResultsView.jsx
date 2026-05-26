import { useState } from 'react'
import { proxiedImageUrl } from './api/imageUrl.js'

function downloadJson(items) {
  const blob = new Blob([JSON.stringify(items, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `instagram-scrape-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function itemTitle(item) {
  return (
    item.ownerUsername ??
    item.username ??
    item.name ??
    item.shortCode ??
    item.id ??
    'Item'
  )
}

function itemSubtitle(item) {
  if (item.caption) return item.caption.slice(0, 120)
  if (item.text) return item.text.slice(0, 120)
  if (item.biography) return item.biography.slice(0, 120)
  return null
}

function itemImage(item) {
  return (
    item.displayUrl ??
    item.profilePicUrl ??
    item.profilePicUrlHD ??
    item.ownerProfilePicUrl ??
    null
  )
}

function itemStats(item) {
  const parts = []
  if (item.likesCount != null) parts.push(`${item.likesCount} likes`)
  if (item.commentsCount != null) parts.push(`${item.commentsCount} comments`)
  if (item.followersCount != null) parts.push(`${item.followersCount} followers`)
  if (item.postsCount != null) parts.push(`${item.postsCount} posts`)
  return parts.join(' · ')
}

export default function ResultsView({ result }) {
  const [expanded, setExpanded] = useState({})

  if (!result) return null

  const { runId, datasetUrl, status, itemCount, truncated, items } = result

  function toggleExpand(index) {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <section className="results">
      <div className="results-header">
        <h2>Results</h2>
        <button type="button" onClick={() => downloadJson(items)}>
          Download JSON
        </button>
      </div>

      <dl className="run-meta">
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Run ID</dt>
          <dd>
            <code>{runId}</code>
          </dd>
        </div>
        <div>
          <dt>Items</dt>
          <dd>
            {items.length}
            {itemCount > items.length && ` of ${itemCount}`}
            {truncated && ' (first page only)'}
          </dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd>
            <a href={datasetUrl} target="_blank" rel="noreferrer">
              Open in Apify Console
            </a>
          </dd>
        </div>
      </dl>

      {items.length === 0 ? (
        <p className="empty">No items returned.</p>
      ) : (
        <ul className="item-list">
          {items.map((item, index) => {
            const img = proxiedImageUrl(itemImage(item))
            const link = item.url ?? item.inputUrl
            return (
              <li key={item.id ?? item.shortCode ?? index} className="item-card">
                {img && (
                  <img
                    src={img}
                    alt=""
                    className="item-thumb"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="item-body">
                  <div className="item-title-row">
                    <strong>{itemTitle(item)}</strong>
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer">
                        View
                      </a>
                    )}
                  </div>
                  {itemSubtitle(item) && (
                    <p className="item-caption">{itemSubtitle(item)}</p>
                  )}
                  {itemStats(item) && (
                    <p className="item-stats">{itemStats(item)}</p>
                  )}
                  <button
                    type="button"
                    className="toggle-json"
                    onClick={() => toggleExpand(index)}
                  >
                    {expanded[index] ? 'Hide JSON' : 'Show JSON'}
                  </button>
                  {expanded[index] && (
                    <pre className="item-json">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
