import { useState, useEffect } from 'react'

export function usePriceData(asset, horizon) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!asset) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const source = asset.source || 'yahoo'
    const url = source === 'hyperliquid'
      ? `/api/chart?source=hl&coin=${encodeURIComponent(asset.hlSymbol)}&horizon=${encodeURIComponent(horizon)}`
      : `/api/chart?symbol=${encodeURIComponent(asset.yahooSymbol)}&horizon=${encodeURIComponent(horizon)}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setData(json.data || [])
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
  }, [asset?.id, horizon])

  return { data, loading, error }
}
