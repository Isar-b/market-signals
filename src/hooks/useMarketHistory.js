import { useState, useEffect } from 'react'
import { POLY_INTERVAL_MAP, getPolyTimestamps } from '../config/horizons'

function getHorizonWindow(horizon) {
  const polyParams = POLY_INTERVAL_MAP[horizon] || POLY_INTERVAL_MAP['YTD']
  const { startTs, endTs } = getPolyTimestamps(horizon)
  const useTimestamps = horizon === '1D' || horizon === '1W'
  return { polyParams, startTs, endTs, useTimestamps }
}

export function buildHistoryUrl(tokenId, horizon) {
  const { polyParams, startTs, endTs, useTimestamps } = getHorizonWindow(horizon)
  let url = `/api/polymarket?target=clob&path=prices-history&market=${tokenId}&interval=${polyParams.interval}&fidelity=${polyParams.fidelity}`
  if (useTimestamps) {
    url += `&startTs=${startTs}&endTs=${endTs}`
  }
  return url
}

export function parseHistoryResponse(json, horizon) {
  const { startTs, endTs, useTimestamps } = getHorizonWindow(horizon)
  let points = json.history || []
  if (!useTimestamps && points.length > 0) {
    points = points.filter(h => h.t >= startTs && h.t <= endTs)
  }
  return points.map(h => ({
    date: new Date(h.t * 1000).toISOString(),
    probability: h.p,
  }))
}

export function useMarketHistory(tokenId, horizon, enabled) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tokenId || !enabled) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(buildHistoryUrl(tokenId, horizon))
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        if (!cancelled) {
          setHistory(parseHistoryResponse(json, horizon))
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
