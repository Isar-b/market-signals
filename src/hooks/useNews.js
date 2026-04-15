import { useState, useEffect } from 'react'
import { HL_TO_MARKET_ID } from '../config/assets'

export function useNews(assetId, assetLabel) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!assetId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // HL assets reuse their Yahoo counterpart's news
    const newsAssetId = HL_TO_MARKET_ID[assetId] || assetId
    const params = new URLSearchParams({ asset: newsAssetId })
    if (assetLabel) params.set('label', assetLabel)

    fetch(`/api/news?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setArticles(json.articles || [])
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [assetId, assetLabel])

  return { articles, loading, error }
}
