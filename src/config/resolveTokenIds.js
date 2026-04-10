import { MARKETS } from './markets'

/**
 * Resolves Polymarket token IDs for all markets at app startup.
 * Fetches from the Gamma API using market slugs, then patches
 * tokenId onto each market entry in-place.
 */
export async function resolveTokenIds() {
  // 1. Collect unique slugs across all assets
  const slugSet = new Set()

  for (const assetMarkets of Object.values(MARKETS)) {
    for (const m of assetMarkets) {
      if (m.polymarketSlug) {
        slugSet.add(m.polymarketSlug)
      }
    }
  }

  // 2. Fetch each slug from Gamma API (batched, 5 concurrent max)
  const slugToTokenId = {}
  const slugArray = [...slugSet]

  for (let i = 0; i < slugArray.length; i += 5) {
    const batch = slugArray.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map(slug => fetchTokenIdForSlug(slug))
    )
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        slugToTokenId[batch[idx]] = result.value
      } else {
        console.warn(`Failed to resolve slug: ${batch[idx]}`, result.reason?.message || result.reason)
      }
    })
  }

  // 3. Handle rolling/expiring Hormuz markets
  await resolveRollingMarkets(slugToTokenId)

  // 4. Patch tokenIds into all MARKETS entries
  for (const assetMarkets of Object.values(MARKETS)) {
    for (const m of assetMarkets) {
      if (!m.tokenId && m.polymarketSlug && slugToTokenId[m.polymarketSlug]) {
        m.tokenId = slugToTokenId[m.polymarketSlug]
      }
    }
  }

  const resolved = Object.keys(slugToTokenId).length
  console.log(`Resolved ${resolved}/${slugArray.length} token IDs`)
  return slugToTokenId
}

async function fetchTokenIdForSlug(slug) {
  const res = await fetch(`/gamma/markets?slug=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`Gamma API ${res.status} for slug: ${slug}`)
  const data = await res.json()

  const market = Array.isArray(data) ? data[0] : data
  if (!market) throw new Error(`No market found for slug: ${slug}`)

  // clobTokenIds may be a JSON string or array
  let tokenIds = market.clobTokenIds
  if (typeof tokenIds === 'string') {
    try { tokenIds = JSON.parse(tokenIds) } catch { /* ignore */ }
  }

  if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
    throw new Error(`No clobTokenIds for slug: ${slug}`)
  }

  return tokenIds[0] // YES outcome
}

async function resolveRollingMarkets(slugToTokenId) {
  for (const assetMarkets of Object.values(MARKETS)) {
    for (const m of assetMarkets) {
      if (!m.expiresApprox) continue

      // Check if the primary market is resolved (expired)
      if (m.polymarketSlug && slugToTokenId[m.polymarketSlug]) {
        try {
          const res = await fetch(`/gamma/markets?slug=${encodeURIComponent(m.polymarketSlug)}`)
          if (res.ok) {
            const data = await res.json()
            const market = Array.isArray(data) ? data[0] : data
            if (market && (market.closed || !market.active)) {
              m.resolved = true
              // Try fallback slug if available
              if (m.fallbackSlug && !slugToTokenId[m.fallbackSlug]) {
                try {
                  const fallbackTokenId = await fetchTokenIdForSlug(m.fallbackSlug)
                  if (fallbackTokenId) {
                    slugToTokenId[m.fallbackSlug] = fallbackTokenId
                  }
                } catch { /* fallback also failed */ }
              }
            }
          }
        } catch { /* ignore */ }
      }
    }
  }
}
