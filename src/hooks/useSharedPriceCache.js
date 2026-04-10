import { useState, useEffect } from 'react'

// Module-level singleton cache: tokenId -> { price, error, timestamp }
const priceCache = new Map()
const subscribers = new Set()
const registeredTokenIds = new Set()
let pollInterval = null

function notifySubscribers() {
  subscribers.forEach(fn => fn())
}

async function fetchAndCache(tokenId) {
  try {
    const res = await fetch(`/clob/price?token_id=${tokenId}&side=BUY`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    priceCache.set(tokenId, {
      price: parseFloat(json.price),
      timestamp: Date.now(),
      error: null,
    })
  } catch (err) {
    priceCache.set(tokenId, {
      price: priceCache.get(tokenId)?.price ?? null,
      timestamp: Date.now(),
      error: err.message,
    })
  }
}

function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    const ids = [...registeredTokenIds]
    await Promise.allSettled(ids.map(id => fetchAndCache(id)))
    notifySubscribers()
  }, 60000)
}

function registerTokenId(tokenId) {
  if (!tokenId) return
  registeredTokenIds.add(tokenId)
  if (!priceCache.has(tokenId)) {
    fetchAndCache(tokenId).then(notifySubscribers)
  }
  startPolling()
}

/**
 * Hook that returns the live price for a given tokenId,
 * using a shared cache so duplicate tokenIds only fetch once per poll cycle.
 */
export function useSharedPrice(tokenId) {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!tokenId) return

    const updater = () => forceUpdate(n => n + 1)
    subscribers.add(updater)
    registerTokenId(tokenId)

    return () => {
      subscribers.delete(updater)
    }
  }, [tokenId])

  const cached = priceCache.get(tokenId)
  return {
    price: cached?.price ?? null,
    error: cached?.error ?? null,
    loading: !cached,
  }
}
