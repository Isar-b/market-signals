import { useState, useEffect } from 'react'
import { buildHistoryUrl, parseHistoryResponse } from './useMarketHistory'

const CONCURRENCY = 5
const moduleCache = new Map()

function cacheKey(tokenId, horizon) {
  return `${tokenId}:${horizon}`
}

async function fetchOne(tokenId, horizon) {
  const key = cacheKey(tokenId, horizon)
  if (moduleCache.has(key)) return { tokenId, history: moduleCache.get(key) }
  const res = await fetch(buildHistoryUrl(tokenId, horizon))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const history = parseHistoryResponse(json, horizon)
  moduleCache.set(key, history)
  return { tokenId, history }
}

async function runBatch(tokenIds, horizon, onResult, isCancelled) {
  const queue = [...tokenIds]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      if (isCancelled()) return
      const tokenId = queue.shift()
      try {
        const { history } = await fetchOne(tokenId, horizon)
        if (!isCancelled()) onResult(tokenId, history, null)
      } catch (err) {
        if (!isCancelled()) onResult(tokenId, null, err.message)
      }
    }
  })
  await Promise.all(workers)
}

export function useMarketHistories(markets, horizon) {
  const [histories, setHistories] = useState(() => new Map())
  const [errors, setErrors] = useState(() => new Map())
  const [loading, setLoading] = useState(false)

  const tokenIdsKey = markets.map(m => m.tokenId).filter(Boolean).join(',')

  useEffect(() => {
    let cancelled = false
    const tokenIds = tokenIdsKey ? tokenIdsKey.split(',') : []

    if (tokenIds.length === 0) {
      setHistories(new Map())
      setErrors(new Map())
      setLoading(false)
      return
    }

    const seeded = new Map()
    const missing = []
    for (const id of tokenIds) {
      const cached = moduleCache.get(cacheKey(id, horizon))
      if (cached) seeded.set(id, cached)
      else missing.push(id)
    }
    setHistories(seeded)
    setErrors(new Map())

    if (missing.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    runBatch(
      missing,
      horizon,
      (tokenId, history, error) => {
        if (history) {
          setHistories(prev => {
            const next = new Map(prev)
            next.set(tokenId, history)
            return next
          })
        } else if (error) {
          setErrors(prev => {
            const next = new Map(prev)
            next.set(tokenId, error)
            return next
          })
        }
      },
      () => cancelled,
    ).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [tokenIdsKey, horizon])

  return { histories, errors, loading }
}
