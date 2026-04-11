import { useState, useEffect } from 'react'
import { POLY_INTERVAL_MAP, getPolyTimestamps } from '../config/horizons'

export function useMarketHistory(tokenId, horizon, enabled) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tokenId || !enabled) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const polyParams = POLY_INTERVAL_MAP[horizon] || POLY_INTERVAL_MAP['YTD']
    const { startTs, endTs } = getPolyTimestamps(horizon)

    // Short ranges (1D, 1W) use startTs/endTs for precise windows.
    // Longer ranges (YTD, 1Y, MAX) omit timestamps — the CLOB API
    // rejects wide ranges. We fetch full history and filter client-side.
    const useTimestamps = horizon === '1D' || horizon === '1W'
    let url = `/api/polymarket?target=clob&path=prices-history&market=${tokenId}&interval=${polyParams.interval}&fidelity=${polyParams.fidelity}`
    if (useTimestamps) {
      url += `&startTs=${startTs}&endTs=${endTs}`
    }

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          let points = json.history || []

          // For longer horizons, filter to the requested time window client-side
          if (!useTimestamps && points.length > 0) {
            points = points.filter(h => h.t >= startTs && h.t <= endTs)
          }

          const data = points.map(h => ({
            date: new Date(h.t * 1000).toISOString(),
            probability: h.p,
          }))
          setHistory(data)
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
  }, [tokenId, horizon, enabled])

  return { history, loading, error }
}
