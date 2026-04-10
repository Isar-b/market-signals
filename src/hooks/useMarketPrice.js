import { useState, useEffect, useRef } from 'react'

export function useMarketPrice(tokenId) {
  const [price, setPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!tokenId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchPrice() {
      try {
        const res = await fetch(`/clob/price?token_id=${tokenId}&side=BUY`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setPrice(parseFloat(json.price))
          setError(null)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    fetchPrice()
    intervalRef.current = setInterval(fetchPrice, 60000)

    return () => {
      cancelled = true
      clearInterval(intervalRef.current)
    }
  }, [tokenId])

  return { price, loading, error }
}
