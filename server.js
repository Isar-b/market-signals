import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import YahooFinance from 'yahoo-finance2'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const yf = new YahooFinance()
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

app.use(cors({ origin: /http:\/\/localhost:\d+/ }))

// ─── Caches ────────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const polymarketCache = { markets: null, timestamp: 0 }
const assetMarketCache = new Map()

// ─── Keyword filters ───────────────────────────────────────────────────────
// Regex patterns for keyword filtering — word boundaries prevent false matches
// (e.g. "fed" won't match "FedEx", "gold" won't match "Golden State Warriors")
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

// ─── /api/chart (yahoo-finance2 proxy) ─────────────────────────────────────
app.get('/api/chart', async (req, res) => {
  try {
    const { symbol, horizon } = req.query
    if (!symbol || !horizon) {
      return res.status(400).json({ error: 'symbol and horizon required' })
    }

    const params = buildChartParams(horizon)
    const result = await yf.chart(symbol, {
      period1: params.period1,
      interval: params.interval,
    })

    const data = (result.quotes || [])
      .filter(q => q.close != null)
      .map(q => ({
        date: q.date instanceof Date ? q.date.toISOString() : q.date,
        close: q.close,
      }))

    res.json({ data })
  } catch (err) {
    console.error('Chart error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

function buildChartParams(horizon) {
  const now = Date.now()
  const DAY = 86400000

  switch (horizon) {
    case '1D':  return { period1: new Date(now - DAY),         interval: '5m'  }
    case '1W':  return { period1: new Date(now - 7 * DAY),     interval: '1h'  }
    case 'YTD': return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
    case '1Y':  return { period1: new Date(now - 365 * DAY),   interval: '1d'  }
    case 'MAX': return { period1: new Date(now - 3650 * DAY),  interval: '1wk' }
    default:    return { period1: `${new Date().getFullYear()}-01-01`, interval: '1d' }
  }
}

// ─── /api/polymarket (unified proxy for CLOB + Gamma) ──────────────────────
const PM_TARGETS = {
  clob: 'https://clob.polymarket.com',
  gamma: 'https://gamma-api.polymarket.com',
}

app.get('/api/polymarket', async (req, res) => {
  try {
    const { target, path, ...queryParams } = req.query
    const baseUrl = PM_TARGETS[target]
    if (!baseUrl || !path) return res.status(400).json({ error: 'target and path required' })

    const url = new URL(`${baseUrl}/${path}`)
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value)
    }

    const upstream = await fetch(url.toString())
    const text = await upstream.text()
    try { res.status(upstream.status).json(JSON.parse(text)) }
    catch { res.status(upstream.status).send(text) }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── /api/search (yahoo symbol search) ─────────────────────────────────────
const USEFUL_TYPES = new Set(['EQUITY', 'ETF', 'INDEX', 'FUTURE', 'CRYPTOCURRENCY'])

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 1) {
      return res.status(400).json({ error: 'q query param required' })
    }

    const data = await yf.search(q, { quotesCount: 8, newsCount: 0 })
    const results = (data.quotes || [])
      .filter(quote => quote.symbol && USEFUL_TYPES.has(quote.quoteType))
      .map(quote => ({
        symbol: quote.symbol,
        shortname: quote.shortname || quote.longname || quote.symbol,
        quoteType: quote.quoteType,
        exchange: quote.exchange,
      }))

    res.json({ results })
  } catch (err) {
    console.error('Search error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── /api/markets (dynamic Polymarket discovery) ───────────────────────────
app.get('/api/markets', async (req, res) => {
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
      console.log('Fetching fresh Polymarket data (10000 markets)...')
      const pages = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          fetch(`https://gamma-api.polymarket.com/markets?limit=500&active=true&closed=false&order=volume24hr&ascending=false&offset=${i * 500}`)
        )
      )
      if (!pages[0].ok) throw new Error(`Gamma API returned ${pages[0].status}`)
      const pageData = await Promise.all(pages.map(p => p.ok ? p.json() : []))
      allMarkets = pageData.flat()
      polymarketCache.markets = allMarkets
      polymarketCache.timestamp = Date.now()
      console.log(`Cached ${allMarkets.length} markets from Polymarket`)
    }

    // 3. Get asset profile + search keywords from LLM
    const assetLabel = label || ASSET_LABELS[asset] || asset
    let assetProfile = null
    let profileKeywords = []
    if (anthropic) {
      try {
        const profileResult = await getAssetProfile(assetLabel, asset)
        assetProfile = profileResult.description
        profileKeywords = profileResult.keywords
        console.log(`Asset profile for ${asset}: ${assetProfile.substring(0, 80)}...`)
        console.log(`Profile keywords: ${profileKeywords.join(', ')}`)
      } catch (err) {
        console.error('Asset profile failed:', err.message)
      }
    }

    // 4. Pre-filter: probability range + keyword matching
    let viableMarkets = allMarkets.filter(m => {
      try {
        const prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices
        if (Array.isArray(prices) && prices.length > 0) {
          const yesPrice = parseFloat(prices[0])
          if (yesPrice < 0.02 || yesPrice > 0.98) return false
        }
      } catch { /* keep if can't parse */ }
      return true
    })

    // Build keyword patterns: hardcoded asset patterns + LLM-generated keywords + macro
    let assetPatterns = ASSET_PATTERNS[asset] || []
    if (assetPatterns.length === 0) {
      const dynamicPatterns = []
      // Symbol and label words
      if (asset) dynamicPatterns.push(new RegExp(`\\b${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
      if (label) {
        label.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3 && !['inc', 'ltd', 'corp', 'the', 'and', 'com', 'plc', 'ord'].includes(w.toLowerCase()))
          .forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
      // LLM-generated keywords (these are specific and high-quality)
      profileKeywords.forEach(kw => {
        dynamicPatterns.push(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
      })
      assetPatterns = dynamicPatterns
    }

    const allPatterns = [...assetPatterns, ...MACRO_PATTERNS]
    let candidates = viableMarkets.filter(m => {
      const text = m.question + ' ' + (m.description || '')
      return allPatterns.some(p => p.test(text))
    })

    // Deduplicate: collapse same-topic markets, remove other companies' market cap markets
    const assetName = (label || ASSET_LABELS[asset] || asset).toLowerCase()
    candidates = deduplicateCandidates(candidates, assetName)

    // Sort: asset-specific matches first, then macro/generic
    // This ensures the LLM sees the most relevant candidates at the top
    candidates.sort((a, b) => {
      const aText = a.question + ' ' + (a.description || '')
      const bText = b.question + ' ' + (b.description || '')
      const aSpecific = assetPatterns.some(p => p.test(aText)) ? 1 : 0
      const bSpecific = assetPatterns.some(p => p.test(bText)) ? 1 : 0
      return bSpecific - aSpecific // asset-specific first
    })

    // Remove sports/entertainment noise unless the asset is sports-related
    const SPORTS_RE = /\b(vs\.|nba|nfl|mlb|nhl|epl|premier league|la liga|serie a|bundesliga|champions league|world cup|goal scorer|touchdown|home run|slam dunk|win .* series|match|bout|ufc|wwe|grand prix|formula 1|f1 race)\b/i
    candidates = candidates.filter(m => !SPORTS_RE.test(m.question))

    // Cap candidates sent to LLM (too many causes it to ignore later entries)
    candidates = candidates.slice(0, 60)

    console.log(`Pre-filtered to ${candidates.length} candidates for ${asset}`)

    // 5. LLM selection (with fallback to top-by-volume)
    let selected
    if (candidates.length <= 5) {
      selected = candidates
    } else {
      try {
        selected = await selectWithLLM(candidates, asset, assetLabel, assetProfile)
      } catch (err) {
        console.error('LLM selection failed, using volume fallback:', err.message)
        selected = candidates.slice(0, 5)
      }
    }

    // Enforce max 2 price/cap markets — code-level, not LLM-dependent
    const PRICE_CAP_RE = /\b(market cap|price|hit \(|dip to|drop to|close above|close below|up or down|high\)|low\)|\$\d)/i
    const priceMarkets = []
    const otherMarkets = []
    for (const m of selected) {
      if (PRICE_CAP_RE.test(m.question)) priceMarkets.push(m)
      else otherMarkets.push(m)
    }
    selected = [...otherMarkets, ...priceMarkets.slice(0, 2)]

    // Backfill: if under 5, add non-price candidates the LLM didn't pick
    if (selected.length < 5) {
      const selectedIds = new Set(selected.map(m => m.question))
      const backfill = candidates.filter(m =>
        !selectedIds.has(m.question) && !PRICE_CAP_RE.test(m.question)
      )
      selected = [...selected, ...backfill].slice(0, 5)
    }

    selected = selected.slice(0, 5)

    // 5. Format response — extract tokenId from clobTokenIds
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
    }).filter(m => m.tokenId) // only include markets with valid tokenIds

    // 6. Cache and return
    assetMarketCache.set(asset, { markets, timestamp: Date.now() })
    res.json({ markets })
  } catch (err) {
    console.error('Markets error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Light deduplication: only remove truly redundant markets.
// 1. "Largest company by market cap" about OTHER companies → remove
// 2. Same question with different dates → keep only nearest future date
// Let the LLM handle thematic diversity.
function deduplicateCandidates(candidates, assetName) {
  const result = []
  const seenNormalized = new Set()

  for (const m of candidates) {
    const q = m.question.toLowerCase()

    // "Largest company by market cap" — only keep if it's about our asset
    if (/largest company.*market cap/i.test(q) || /market cap.*largest/i.test(q)) {
      const isAboutOurAsset = assetName.split(/\s+/).some(word =>
        word.length >= 3 && q.includes(word.toLowerCase())
      )
      if (!isAboutOurAsset) continue
    }

    // Collapse same-question-different-date duplicates only
    // e.g. "Hormuz by April 30" and "Hormuz by May 31" → keep first (highest volume)
    const normalized = q
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '_DATE_')
      .replace(/\b20\d{2}\b/g, '_YEAR_')
      .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, '_D_')
      .replace(/\b(largest|second[- ]largest|third[- ]largest|\d+th[- ]largest|biggest|second[- ]biggest|third[- ]biggest)\b/gi, '_RANK_')
      .replace(/\b(increase|decrease|cut|hike|raise|lower|dip|drop|rally|surge|climb|plunge|crash|soar)\b/gi, '_CHANGE_')
      .replace(/\b(hit|reach|exceed|surpass|drop below|fall below|above|below|up or down)\b/gi, '_THRESHOLD_')
      .replace(/\((?:low|high|open|close)\)/gi, '_HL_')
      .replace(/\$[\d,.]+[btmk]?\b/gi, '_PRICE_')
      .replace(/\bweek of\b/gi, '_WEEK_')
      .replace(/\s+/g, ' ')
      .trim()

    if (seenNormalized.has(normalized)) continue
    seenNormalized.add(normalized)
    result.push(m)
  }

  return result
}

async function getAssetProfile(assetLabel, assetSymbol) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Describe what ${assetLabel} (${assetSymbol}) is and what moves its price. Then provide search keywords.

Return JSON in this exact format:
{
  "description": "2-3 sentence description of the asset, its industry, and key price drivers",
  "keywords": ["keyword1", "keyword2", ...]
}

The keywords should be specific terms to search prediction markets for events that would move this asset's price. Include:
- The company/asset name, ticker, and ALL major brand/product names (e.g. for Google: "Gemini", "Android", "YouTube", "Pixel", "Chrome", "Waymo", "DeepMind")
- Direct competitors and partners
- Key people (CEO, founders)
- Industry-specific terms
- Geographic markets (e.g. "UK", "China", "Europe")
- Relevant indices (e.g. "FTSE", "Nasdaq")
- Relevant currencies (e.g. "pound", "sterling", "euro")
- Regulatory bodies (e.g. "FCA", "SEC", "EU")
- Sector terms (e.g. "semiconductor", "cloud", "oil")

Return 20-30 keywords. Be exhaustive with product/brand names. Only return the JSON, no other text.`
    }],
  })

  const text = response.content[0].text.trim()
  try {
    const parsed = JSON.parse(text)
    return {
      description: parsed.description || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    }
  } catch {
    // If JSON parse fails, treat whole response as description
    return { description: text, keywords: [] }
  }
}

async function selectWithLLM(candidates, assetId, assetLabel, assetProfile) {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  assetLabel = assetLabel || ASSET_LABELS[assetId] || assetId
  const candidateList = candidates.map((m, i) =>
    `${i}. "${m.question}" (24h vol: $${Math.round(Number(m.volume24hr || 0)).toLocaleString()})`
  ).join('\n')

  const prompt = `You are selecting prediction markets for a financial dashboard tracking: ${assetLabel}.
${assetProfile ? `\nABOUT THIS ASSET: ${assetProfile}\n` : ''}
STEP 1: Group the markets below by topic (e.g. "market cap ranking", "leadership", "product launch", "tariffs", "interest rates", etc.)
STEP 2: From each topic group, pick only the SINGLE most interesting market (highest volume or most direct impact on ${assetLabel}).
STEP 3: Return up to 5 markets, each from a DIFFERENT topic group.

PRIORITY ORDER — pick from higher tiers first:
1. Markets DIRECTLY about ${assetLabel} by name (earnings, leadership, lawsuits, products)
2. Markets about ${assetLabel}'s specific SECTOR or INDUSTRY (e.g. fintech, EVs, semiconductors)
3. Markets about ${assetLabel}'s key GEOGRAPHIC markets (e.g. Brazil, China, EU)
4. Markets about direct competitors or partners by name
5. Macro/policy events ONLY if they specifically impact ${assetLabel}'s sector or geography

HARD RULES:
- DIVERSITY IS MANDATORY: never return 2+ markets on the same topic, even if they differ by date or threshold
- Every market must have a clear, specific causal link to ${assetLabel}'s price — you must be able to explain HOW it moves the stock
- REJECT markets about unrelated sectors (e.g. Bitcoin/crypto markets for a non-crypto stock, oil markets for a tech company)
- REJECT generic macro (Fed Chair, GDP, recession) unless ${assetLabel} is a broad market index
- MAX 2 markets about price targets, price action, or market cap ranking — prioritise non-price markets (products, leadership, regulation, competitors, sector events)
- If fewer than 5 topics are genuinely relevant, return fewer. Return an EMPTY array [] if nothing is relevant. DO NOT pad with irrelevant markets.

Markets:
${candidateList}

Return ONLY a JSON array of indices, e.g. [0, 3, 7]. No other text.`

  // Try Sonnet first (better reasoning), fall back to Haiku
  let response
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
  }

  const text = response.content[0].text.trim()

  // Try parsing as JSON first
  let indices
  try {
    indices = JSON.parse(text)
  } catch {
    // Fallback: extract numbers from response
    const matches = text.match(/\d+/g)
    if (!matches) throw new Error('Could not parse LLM response: ' + text)
    indices = matches.map(Number)
  }

  return indices
    .filter(i => typeof i === 'number' && i >= 0 && i < candidates.length)
    .slice(0, 10)
    .map(i => candidates[i])
}

// ─── Start server ──────────────────────────────────────────────────────────
const PORT = 3001
app.listen(PORT, () => {
  console.log(`Yahoo proxy running on http://localhost:${PORT}`)
  console.log(`Dynamic markets API: http://localhost:${PORT}/api/markets?asset=SP500`)
  if (!anthropic) {
    console.warn('⚠ ANTHROPIC_API_KEY not set — LLM selection disabled, using volume fallback')
  }
})

