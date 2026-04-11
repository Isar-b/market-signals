import Anthropic from '@anthropic-ai/sdk'

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

// ─── Caches (persist across warm serverless invocations) ───────────────────
const CACHE_TTL = 5 * 60 * 1000
const polymarketCache = { markets: null, timestamp: 0 }
const assetMarketCache = new Map()

// ─── Keyword filters ───────────────────────────────────────────────────────
const ASSET_PATTERNS = {
  SP500: [/s&p/i, /\bsp500\b/i, /\bsp 500\b/i, /stock market/i, /\bdow\b/i, /equities/i],
  NDX:   [/nasdaq/i, /tech stock/i, /tech sector/i],
  OIL:   [/\boil\b/i, /crude/i, /brent/i, /opec/i, /hormuz/i, /\biran\b/i, /energy price/i, /petroleum/i],
  GOLD:  [/\bgold\b(?! ?en)/i, /precious metal/i, /bullion/i],
  TSLA:  [/tesla/i, /\btsla\b/i, /\bmusk\b/i, /spacex/i, /\bxai\b/i, /electric vehicle/i],
  NVDA:  [/nvidia/i, /\bnvda\b/i, /semiconductor/i, /\bgpu\b/i],
  MSFT:  [/microsoft/i, /\bmsft\b/i, /openai/i, /\bazure\b/i],
  AAPL:  [/\bapple\b(?! ?bee)/i, /\baapl\b/i, /iphone/i, /app store/i],
}

const MACRO_PATTERNS = [
  /\bfed\b(?!ex| ?cup)/i, /interest rate/i, /rate cut/i, /rate hike/i,
  /recession/i, /inflation/i, /\btariff/i, /\bgdp\b/i, /unemployment/i,
  /market cap/i, /\bipo\b/i, /treasury/i, /debt ceiling/i,
]

const ASSET_LABELS = {
  SP500: 'S&P 500 index',
  NDX: 'Nasdaq 100 index',
  OIL: 'Brent crude oil',
  GOLD: 'Gold',
  TSLA: 'Tesla stock',
  NVDA: 'Nvidia stock',
  MSFT: 'Microsoft stock',
  AAPL: 'Apple stock',
}

// ─── Helper functions ──────────────────────────────────────────────────────

function extractTopicKey(question) {
  const topicPatterns = [
    [/\bfed\b.*\b(rate|interest|bps)\b/i, 'fed-rate'],
    [/\b(rate|interest)\b.*\bfed\b/i, 'fed-rate'],
    [/\bfed\b.*\bchair\b/i, 'fed-chair'],
    [/\bfed rate cuts?\b.*\b20\d{2}\b/i, 'fed-rate-cuts-annual'],
    [/\brecession\b/i, 'recession'],
    [/\btariff/i, 'tariffs'],
    [/\binflation\b/i, 'inflation'],
    [/\bbank of japan\b/i, 'boj'],
    [/\bceasefire\b/i, 'ceasefire'],
    [/\bhormuz\b/i, 'hormuz'],
    [/\bkharg\b/i, 'kharg'],
    [/\biran\b/i, 'iran'],
    [/\blargest company\b.*\bmarket cap\b/i, 'largest-marketcap'],
    [/\bmarket cap\b.*\blargest\b/i, 'largest-marketcap'],
    [/\bipo\b/i, 'ipo'],
    [/\bcrud(e)?\s*oil\b|\bwti\b|\bbrent\b/i, 'crude-oil'],
    [/\bgold\b(?!en)/i, 'gold-price'],
    [/\bup or down\b/i, 'daily-direction'],
  ]

  const q = question.toLowerCase()
  const matchedTopics = []
  for (const [pattern, topic] of topicPatterns) {
    if (pattern.test(q)) matchedTopics.push(topic)
  }

  const entities = []
  const entityPatterns = [
    /\b(tesla|nvidia|apple|microsoft|amazon|alphabet|google|meta|spacex|openai|samsung)\b/i,
    /\b(tsla|nvda|aapl|msft|amzn|goog|meta|spx|spax)\b/i,
  ]
  for (const p of entityPatterns) {
    const match = q.match(p)
    if (match) entities.push(match[1].toLowerCase())
  }

  const key = [...matchedTopics, ...entities].sort().join('|')
  return key || q.replace(/[^a-z]+/gi, ' ').trim().substring(0, 50)
}

function deduplicateCandidates(candidates, assetName) {
  const result = []
  const seenTopics = new Set()

  for (const m of candidates) {
    const q = m.question.toLowerCase()

    if (/largest company.*market cap/i.test(q) || /market cap.*largest/i.test(q)) {
      const isAboutOurAsset = assetName.split(/\s+/).some(word =>
        word.length >= 3 && q.includes(word.toLowerCase())
      )
      if (!isAboutOurAsset) continue
    }

    const normalized = extractTopicKey(q)
    if (seenTopics.has(normalized)) continue
    seenTopics.add(normalized)
    result.push(m)
  }

  return result
}

async function getAssetProfile(assetLabel, assetSymbol) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `In 2-3 sentences, describe what ${assetLabel} (${assetSymbol}) is and what key factors/sectors/events move its price. Focus on: industry, supply chain dependencies, regulatory exposure, geographic risks, and macro sensitivities. Be specific.`
    }],
  })
  return response.content[0].text.trim()
}

async function selectWithLLM(candidates, assetId, assetLabel, assetProfile) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured')

  assetLabel = assetLabel || ASSET_LABELS[assetId] || assetId
  const candidateList = candidates.map((m, i) =>
    `${i}. "${m.question}" (24h vol: $${Math.round(Number(m.volume24hr || 0)).toLocaleString()})`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are selecting prediction markets for a financial dashboard. The user is tracking: ${assetLabel}.
${assetProfile ? `\nABOUT THIS ASSET: ${assetProfile}\n` : ''}
Pick the markets from the list below that a trader watching ${assetLabel} would most want to see. Use the asset description above to judge relevance.

STRICT RELEVANCE TEST — only include a market if you can explain in one sentence WHY it would move ${assetLabel}'s price. Examples:
- Tariff markets → relevant to companies with China/international supply chains
- Fed rate decisions → relevant to rate-sensitive sectors (real estate, growth stocks, indices)
- Iran/OPEC/Hormuz → relevant to oil & energy, NOT to unrelated companies
- Oil price targets → relevant to oil assets, airlines, shipping, NOT to software or footwear
- "Largest company by market cap" → ONLY include if it's about ${assetLabel} itself, never about other companies

DO NOT include:
- Markets with only a vague/indirect connection (e.g. "oil prices" for a footwear company)
- Generic macro events that affect everything equally, unless this is a broad market index
- Near-duplicate markets (same topic, different dates) — pick nearest future date only
- Fed Chair confirmation, Bank of Japan, or other central bank appointments unless this asset is directly rate-sensitive

Return exactly 5 markets. You MUST return 5 — if direct matches are limited, include the best available macro/sector markets that have some relevance.

Markets:
${candidateList}

Return ONLY a JSON array of indices, e.g. [0, 3, 7]. No other text.`
    }],
  })

  const text = response.content[0].text.trim()
  let indices
  try {
    indices = JSON.parse(text)
  } catch {
    const matches = text.match(/\d+/g)
    if (!matches) throw new Error('Could not parse LLM response: ' + text)
    indices = matches.map(Number)
  }

  return indices
    .filter(i => typeof i === 'number' && i >= 0 && i < candidates.length)
    .slice(0, 5)
    .map(i => candidates[i])
}

// ─── Main handler ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    const { asset, label } = req.query
    if (!asset) {
      return res.status(400).json({ error: 'asset query param required' })
    }

    // 1. Check per-asset cache (require at least 3 markets to use cache)
    const cached = assetMarketCache.get(asset)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.markets.length >= 3) {
      return res.json({ markets: cached.markets, source: 'cache' })
    }

    // 2. Fetch or use cached Polymarket data
    let allMarkets
    if (polymarketCache.markets && Date.now() - polymarketCache.timestamp < CACHE_TTL) {
      allMarkets = polymarketCache.markets
    } else {
      const [page1, page2] = await Promise.all([
        fetch('https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false'),
        fetch('https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false&offset=500'),
      ])
      if (!page1.ok) throw new Error(`Gamma API returned ${page1.status}`)
      const data1 = await page1.json()
      const data2 = page2.ok ? await page2.json() : []
      allMarkets = [...data1, ...data2]
      polymarketCache.markets = allMarkets
      polymarketCache.timestamp = Date.now()
    }

    // 3. Get asset profile from LLM
    const assetLabel = label || ASSET_LABELS[asset] || asset
    let assetProfile = null
    if (anthropic) {
      try {
        assetProfile = await getAssetProfile(assetLabel, asset)
      } catch (err) {
        console.error('Asset profile failed:', err.message)
      }
    }

    // 4. Pre-filter: probability range + keyword matching
    let viableMarkets = allMarkets.filter(m => {
      try {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices) : m.outcomePrices
        if (Array.isArray(prices) && prices.length > 0) {
          const yesPrice = parseFloat(prices[0])
          if (yesPrice < 0.02 || yesPrice > 0.98) return false
        }
      } catch { /* keep */ }
      return true
    })

    let assetPatterns = ASSET_PATTERNS[asset] || []
    if (assetPatterns.length === 0) {
      const dynamicPatterns = []
      if (asset) dynamicPatterns.push(new RegExp(`\\b${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
      if (label) {
        const words = label.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3 && !['inc', 'ltd', 'corp', 'the', 'and', 'com'].includes(w.toLowerCase()))
        words.forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
      if (assetProfile) {
        const profileWords = assetProfile.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/).filter(w => w.length >= 4).map(w => w.toLowerCase())
        const stopWords = ['this', 'that', 'with', 'from', 'they', 'their', 'would', 'could', 'about', 'which', 'these', 'those', 'into', 'also', 'such', 'like', 'make', 'more', 'most', 'some', 'than', 'very', 'when', 'what', 'will', 'been', 'have', 'each', 'were', 'then', 'them', 'over', 'does', 'its']
        const uniqueWords = [...new Set(profileWords)].filter(w => !stopWords.includes(w)).slice(0, 15)
        uniqueWords.forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
      assetPatterns = dynamicPatterns
    }

    const allPatterns = [...assetPatterns, ...MACRO_PATTERNS]
    let candidates = viableMarkets.filter(m => {
      const text = m.question + ' ' + (m.description || '')
      return allPatterns.some(p => p.test(text))
    })

    const assetName = (label || ASSET_LABELS[asset] || asset).toLowerCase()
    candidates = deduplicateCandidates(candidates, assetName)

    // 5. LLM selection
    let selected
    if (candidates.length <= 5) {
      selected = candidates
    } else {
      try {
        selected = await selectWithLLM(candidates, asset, assetLabel, assetProfile)
      } catch (err) {
        console.error('LLM selection failed:', err.message)
        selected = candidates.slice(0, 5)
      }
    }

    // 6. Format response
    const markets = selected.map(m => {
      let tokenIds = m.clobTokenIds
      if (typeof tokenIds === 'string') {
        try { tokenIds = JSON.parse(tokenIds) } catch { /* ignore */ }
      }
      return {
        id: m.slug || m.conditionId,
        label: m.question,
        tokenId: Array.isArray(tokenIds) && tokenIds.length > 0 ? tokenIds[0] : null,
        volume24hr: m.volume24hr,
      }
    }).filter(m => m.tokenId)

    assetMarketCache.set(asset, { markets, timestamp: Date.now() })
    res.json({ markets })
  } catch (err) {
    console.error('Markets error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
