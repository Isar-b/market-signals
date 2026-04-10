import { useState, useEffect } from 'react'

export function useDynamicMarkets(assetId, assetLabel) {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!assetId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ asset: assetId })
    if (assetLabel) params.set('label', assetLabel)

    fetch(`http://localhost:3001/api/markets?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setMarkets(json.markets || [])
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

  return { markets, loading, error }
}
