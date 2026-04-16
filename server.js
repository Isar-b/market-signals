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
  BTC:   [/\bbitcoin\b/i, /\bbtc\b/i, /\bcrypto\b/i, /\bhalving\b/i, /\bsatoshi\b/i, /\bblockchain\b/i],
  ETH:   [/\bethereum\b/i, /\beth\b(?!anol)/i, /\bdefi\b/i, /\bvitalik\b/i, /\bstaking\b/i, /\blayer.?2\b/i],
  TSLA:  [/tesla/i, /\btsla\b/i, /\bmusk\b/i, /spacex/i, /\bxai\b/i, /electric vehicle/i],
  NVDA:  [/nvidia/i, /\bnvda\b/i, /semiconductor/i, /\bgpu\b/i],
  MSFT:  [/microsoft/i, /\bmsft\b/i, /openai/i, /\bazure\b/i],
  AAPL:  [/\bapple\b(?! ?bee)/i, /\baapl\b/i, /iphone/i, /app store/i],
}
ASSET_PATTERNS.SP500_HL = ASSET_PATTERNS.SP500
ASSET_PATTERNS.OIL_HL = ASSET_PATTERNS.OIL

const MACRO_PATTERNS = [
  /\bfed\b(?!ex| ?cup)/i, /interest rate/i, /rate cut/i, /rate hike/i,
  /recession/i, /inflation/i, /\btariff/i, /\bgdp\b/i, /unemployment/i,
  /market cap/i, /\bipo\b/i, /treasury/i, /debt ceiling/i,
]

const ASSET_LABELS = {
  SP500: 'S&P 500 index',
  SP500_HL: 'S&P 500 index',
  NDX: 'Nasdaq 100 index',
  OIL: 'Brent crude oil',
  OIL_HL: 'Brent crude oil',
  GOLD: 'Gold',
  BTC: 'Bitcoin cryptocurrency',
  ETH: 'Ethereum cryptocurrency',
  TSLA: 'Tesla stock',
  NVDA: 'Nvidia stock',
  MSFT: 'Microsoft stock',
  AAPL: 'Apple stock',
}

// ─── Hyperliquid helpers ───────────────────────────────────────────────────
const HL_VALID_COINS = new Set(['BTC', 'ETH', 'xyz:SP500', 'xyz:BRENTOIL'])

function buildHLParams(horizon) {
  const now = Date.now()
  const DAY = 86400000
  switch (horizon) {
    case '1D':  return { interval: '5m',  startTime: now - DAY,       endTime: now }
    case '1W':  return { interval: '1h',  startTime: now - 7 * DAY,   endTime: now }
    case '1M':  return { interval: '1d',  startTime: now - 30 * DAY,  endTime: now }
    case 'YTD': return { interval: '1d',  startTime: new Date(new Date().getFullYear(), 0, 1).getTime(), endTime: now }
    case '1Y':  return { interval: '1d',  startTime: now - 365 * DAY, endTime: now }
    case 'MAX': return { interval: '1w',  startTime: now - 3650 * DAY, endTime: now }
    default:    return { interval: '1d',  startTime: new Date(new Date().getFullYear(), 0, 1).getTime(), endTime: now }
  }
}

async function fetchHyperliquid(coin, horizon) {
  const params = buildHLParams(horizon)
  const resp = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'candleSnapshot',
      req: { coin, interval: params.interval, startTime: params.startTime, endTime: params.endTime },
    }),
  })
  if (!resp.ok) throw new Error(`Hyperliquid API returned ${resp.status}`)
  const candles = await resp.json()
  return candles
    .filter(c => c.c != null)
    .map(c => ({ date: new Date(c.t).toISOString(), close: parseFloat(c.c) }))
}

// ─── /api/chart (yahoo-finance2 + Hyperliquid proxy) ──────────────────────
app.get('/api/chart', async (req, res) => {
  try {
    const { symbol, horizon, source, coin } = req.query

    if (source === 'hl') {
      if (!coin || !horizon) return res.status(400).json({ error: 'coin and horizon required' })
      if (!HL_VALID_COINS.has(coin)) return res.status(400).json({ error: 'Invalid coin' })
      const data = await fetchHyperliquid(coin, horizon)
      return res.json({ data })
    }

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
    case '1M':  return { period1: new Date(now - 30 * DAY),   interval: '1d'  }
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

// ─── /api/news (TheNewsAPI proxy) ──────────────────────────────────────────
const newsCache = new Map()
const NEWS_CACHE_TTL = 15 * 60 * 1000

const NEWS_SEARCH_OVERRIDES = {
  SP500:    '"S&P 500" | "stock market" | "Wall Street"',
  SP500_HL: '"S&P 500" | "stock market" | "Wall Street"',
  NDX:      '"Nasdaq" | "tech stocks"',
  OIL:      '"crude oil" | "Brent" | "OPEC" | "oil price"',
  OIL_HL:   '"crude oil" | "Brent" | "OPEC" | "oil price"',
  GOLD:     '"gold price" | "precious metals" | "gold bullion"',
  BTC:      '"Bitcoin" | "BTC" | "crypto"',
  ETH:      '"Ethereum" | "ETH" | "DeFi"',
}

async function filterNewsWithLLM(articles, assetLabel) {
  if (!anthropic || articles.length <= 5) return articles

  const numbered = articles.map((a, i) => `${i}. ${a.title}`).join('\n')
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Which of these news articles are directly relevant to ${assetLabel} as a financial asset? Return ONLY a JSON array of index numbers for the top 5 most relevant articles (e.g. [0,3,7,9,12]). If fewer than 5 are relevant, return fewer. Articles:\n${numbered}`,
    }],
  })

  try {
    const text = response.content[0]?.text || '[]'
    const match = text.match(/\[[\d,\s]*\]/)
    if (!match) return articles.slice(0, 5)
    const indices = JSON.parse(match[0])
    const filtered = indices
      .filter(i => i >= 0 && i < articles.length)
      .map(i => articles[i])
    return filtered.length > 0 ? filtered : articles.slice(0, 5)
  } catch {
    return articles.slice(0, 5)
  }
}

async function fetchNewsArticles(asset, label) {
  const cacheKey = `news:${asset}`
  const cached = newsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL) return cached.data

  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) return []

  const search = NEWS_SEARCH_OVERRIDES[asset] || `"${label}"`
  const after = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const params = new URLSearchParams({
    api_token: apiKey,
    search,
    language: 'en',
    published_after: after,
    sort: 'relevance_score',
    limit: '15',
  })

  const resp = await fetch(`https://api.thenewsapi.com/v1/news/all?${params}`)
  if (!resp.ok) throw new Error(`News API returned ${resp.status}`)
  const json = await resp.json()

  const allArticles = (json.data || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source,
    snippet: a.snippet || a.description || '',
    publishedAt: a.published_at,
    imageUrl: a.image_url,
  }))

  const articles = await filterNewsWithLLM(allArticles, label)

  newsCache.set(cacheKey, { data: articles, ts: Date.now() })
  return articles
}

function formatNewsContext(articles) {
  if (!articles || articles.length === 0) return ''
  return articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.source}, ${new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`)
    .join('\n')
}

app.get('/api/news', async (req, res) => {
  try {
    const { asset, label } = req.query
    if (!asset) return res.status(400).json({ error: 'asset query param required' })
    const articles = await fetchNewsArticles(asset, label || ASSET_LABELS[asset] || asset)
    res.json({ articles })
  } catch (err) {
    console.error('News error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── /api/fred (Federal Reserve Economic Data) ────────────────────────────
const FRED_CACHE_TTL = 60 * 60 * 1000
let fredCache = { data: null, ts: 0 }

const FRED_SERIES = [
  { id: 'GDPNOW',   label: 'GDPNow Estimate',   units: 'lin',  suffix: '%', category: 'Growth' },
  { id: 'CPIAUCSL', label: 'CPI (Headline YoY)', units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'CPILFESL', label: 'CPI (Core YoY)',     units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'PCEPI',    label: 'PCE (Headline YoY)', units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'PCEPILFE', label: 'PCE (Core YoY)',     units: 'pc1',  suffix: '%', category: 'Inflation' },
  { id: 'UNRATE',   label: 'Unemployment Rate',  units: 'lin',  suffix: '%', category: 'Labor' },
]

app.get('/api/fred', async (req, res) => {
  try {
    if (fredCache.data && Date.now() - fredCache.ts < FRED_CACHE_TTL) {
      return res.json({ indicators: fredCache.data })
    }

    const apiKey = process.env.FRED_API_KEY
    if (!apiKey) return res.json({ indicators: [] })

    const results = await Promise.all(
      FRED_SERIES.map(async (s) => {
        try {
          const params = new URLSearchParams({
            series_id: s.id, api_key: apiKey, file_type: 'json',
            sort_order: 'desc', limit: '2', units: s.units,
          })
          const resp = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`)
          const json = await resp.json()
          const obs = (json.observations || []).filter(o => o.value !== '.')
          const latest = obs[0]
          const previous = obs[1]
          const value = latest ? parseFloat(latest.value) : null
          const prevValue = previous ? parseFloat(previous.value) : null
          return {
            id: s.id, label: s.label, category: s.category,
            value, suffix: s.suffix, date: latest?.date || null,
            prevDate: previous?.date || null,
            delta: (value != null && prevValue != null) ? value - prevValue : null,
          }
        } catch (err) {
          console.error(`FRED ${s.id} failed:`, err.message)
          return { id: s.id, label: s.label, category: s.category, value: null, suffix: s.suffix, date: null, prevDate: null, delta: null }
        }
      })
    )

    fredCache = { data: results, ts: Date.now() }
    res.json({ indicators: results })
  } catch (err) {
    console.error('FRED error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── /api/stock-summary (Yahoo Finance quoteSummary) ──────────────────────
const stockCache = new Map()
const STOCK_CACHE_TTL = 15 * 60 * 1000

app.get('/api/stock-summary', async (req, res) => {
  try {
    const { symbol } = req.query
    if (!symbol) return res.status(400).json({ error: 'symbol required' })

    const cached = stockCache.get(symbol)
    if (cached && Date.now() - cached.ts < STOCK_CACHE_TTL) return res.json(cached.data)

    const q = await yf.quoteSummary(symbol, {
      modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics', 'earningsHistory', 'calendarEvents'],
    })

    const profile = q.summaryProfile || {}
    const fin = q.financialData || {}
    const stats = q.defaultKeyStatistics || {}
    const earnings = q.earningsHistory?.history || []
    const calendar = q.calendarEvents?.earnings || {}

    const result = {
      sector: profile.sector || null,
      industry: profile.industry || null,
      summary: profile.longBusinessSummary
        ? profile.longBusinessSummary.substring(0, 300) + (profile.longBusinessSummary.length > 300 ? '...' : '')
        : null,
      employees: profile.fullTimeEmployees || null,
      forwardPE: stats.forwardPE || null,
      trailingPE: (fin.currentPrice && stats.trailingEps) ? +(fin.currentPrice / stats.trailingEps).toFixed(1) : null,
      priceToBook: stats.priceToBook ? +stats.priceToBook.toFixed(1) : null,
      evToRevenue: stats.enterpriseToRevenue ? +stats.enterpriseToRevenue.toFixed(1) : null,
      earningsHistory: earnings.map(e => ({
        quarter: e.quarter, actual: e.epsActual, estimate: e.epsEstimate, surprise: e.surprisePercent,
      })),
      nextEarningsDate: calendar.earningsDate?.[0] || null,
      nextEarningsEstimate: calendar.earningsAverage || null,
      revenue: fin.totalRevenue || null,
      revenueGrowth: fin.revenueGrowth || null,
      grossMargins: fin.grossMargins || null,
      profitMargins: fin.profitMargins || null,
      freeCashflow: fin.freeCashflow || null,
      shortPercentOfFloat: stats.shortPercentOfFloat || null,
      shortRatio: stats.shortRatio || null,
      recommendation: fin.recommendationKey || null,
      targetLow: fin.targetLowPrice || null,
      targetMedian: fin.targetMedianPrice || null,
      targetHigh: fin.targetHighPrice || null,
      analystCount: fin.numberOfAnalystOpinions || null,
    }

    stockCache.set(symbol, { data: result, ts: Date.now() })
    res.json(result)
  } catch (err) {
    console.error('Stock summary error:', err.message)
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
    const INDEX_RE = /\b(s&p|index|composite|dow jones|nasdaq|ftse|russell|nikkei|hang seng|stoxx|dax\b|cac\b|vix|cboe|nyse|kospi|sensex|ibovespa|tsx)\b/i
    const isIndex = ['SP500', 'SP500_HL', 'NDX', 'OIL', 'OIL_HL', 'GOLD', 'BTC', 'ETH'].includes(asset) || INDEX_RE.test(assetLabel)
    const marketLimit = isIndex ? 10 : 5
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

    // 3b. Get current news context via TheNewsAPI (all assets)
    let newsContext = ''
    try {
      const articles = await fetchNewsArticles(asset, assetLabel)
      newsContext = formatNewsContext(articles)
      if (newsContext) console.log(`News context for ${asset}: ${articles.length} articles`)
    } catch (err) {
      console.error('News context failed:', err.message)
    }

    // 4. Pre-filter: exclude closed/resolved/expired + probability range
    const now = Date.now()
    let viableMarkets = allMarkets.filter(m => {
      if (m.closed || !m.active || m.acceptingOrders === false) return false
      if (m.endDateIso && new Date(m.endDateIso).getTime() < now) return false
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
          .filter(w => w.length >= 3
            && !['inc', 'ltd', 'corp', 'the', 'and', 'com', 'plc', 'ord', 'new', 'index', 'fund', 'trust', 'group', 'jones', 'standard', 'poor', 'average', 'composite', 'holdings', 'global'].includes(w.toLowerCase())
            && !/^\d+$/.test(w))
          .forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
      // LLM-generated keywords (these are specific and high-quality)
      profileKeywords.forEach(kw => {
        dynamicPatterns.push(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
      })
      assetPatterns = dynamicPatterns
    }

    const allPatterns = isIndex
      ? [...assetPatterns, ...MACRO_PATTERNS]
      : assetPatterns
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
    const SPORTS_RE = /\bvs\.?\s|\b(nba|nfl|mlb|nhl|epl|premier league|la liga|serie a|bundesliga|champions league|world cup|goal scorer|touchdown|home run|slam dunk|win .* series|bout|ufc|wwe|grand prix|formula 1|f1 race|win .*season|subscribers|lcs|lec|valorant|esport|league of legends)\b/i
    candidates = candidates.filter(m => !SPORTS_RE.test(m.question))

    // Remove election/political noise (unless asset is specifically political/geopolitical)
    const ELECTION_RE = /\b(win the most seats|parliamentary election|presidential election|win the national list|Nobel Peace Prize|leader of .* end of)\b/i
    candidates = candidates.filter(m => !ELECTION_RE.test(m.question))

    // Cap candidates sent to LLM (too many causes it to ignore later entries)
    candidates = candidates.slice(0, 60)

    console.log(`Pre-filtered to ${candidates.length} candidates for ${asset}`)

    // 5. LLM selection (with fallback to top-by-volume)
    let selected
    if (candidates.length <= marketLimit) {
      selected = candidates
    } else {
      try {
        selected = await selectWithLLM(candidates, asset, assetLabel, assetProfile, marketLimit, newsContext)
      } catch (err) {
        console.error('LLM selection failed, using volume fallback:', err.message)
        selected = candidates.slice(0, marketLimit)
      }
    }

    // Deduplicate by question text (same market can have multiple Polymarket entries)
    const seenQuestions = new Set()
    selected = selected.filter(m => {
      if (seenQuestions.has(m.question)) return false
      seenQuestions.add(m.question)
      return true
    })

    // Enforce max 2 price/cap markets — code-level, not LLM-dependent
    const PRICE_CAP_RE = /\b(market cap|price|hit \(|dip to|drop to|close above|close below|up or down|high\)|low\)|settle|trading day|all[- ]time[- ]high|reach \$|above \$|below \$|\$\d)/i
    const priceMarkets = []
    const otherMarkets = []
    for (const m of selected) {
      if (PRICE_CAP_RE.test(m.question)) priceMarkets.push(m)
      else otherMarkets.push(m)
    }
    selected = [...otherMarkets, ...priceMarkets.slice(0, 2)].slice(0, marketLimit)

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
    const q = m.question
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+(?:[- ][A-Z][a-z]+)*/g, '_NAME_')
      .toLowerCase()

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
      .replace(/"[^"]+"/g, '_TITLE_')
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '_DATE_')
      .replace(/\b20\d{2}\b/g, '_YEAR_')
      .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, '_D_')
      .replace(/\b(largest|second[- ]largest|third[- ]largest|\d+th[- ]largest|biggest|second[- ]biggest|third[- ]biggest)\b/gi, '_RANK_')
      .replace(/\b(increase|decrease|cut|hike|raise|lower|dip|drop|rally|surge|climb|plunge|crash|soar)\b/gi, '_CHANGE_')
      .replace(/\b(hit|reach|exceed|surpass|drop below|fall below|above|below|up or down)\b/gi, '_THRESHOLD_')
      .replace(/\((?:low|high|open|close)\)/gi, '_HL_')
      .replace(/\$[\d,.]+[btmk]?\b/gi, '_NUM_')
      .replace(/\b\d[\d,.]{2,}[btmk]?\b/gi, '_NUM_')
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

IMPORTANT: Treat the asset name as a company/financial instrument, NOT a literal word. For example, "Snowflake" is a cloud data company (not weather/ice), "Apple" is a tech company (not fruit), "Shell" is an oil company (not seashells).

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


async function selectWithLLM(candidates, assetId, assetLabel, assetProfile, marketLimit = 5, newsContext = '') {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  assetLabel = assetLabel || ASSET_LABELS[assetId] || assetId
  const candidateList = candidates.map((m, i) =>
    `${i}. "${m.question}" (24h vol: $${Math.round(Number(m.volume24hr || 0)).toLocaleString()})`
  ).join('\n')

  const prompt = `You are a strict editor selecting prediction markets for a financial dashboard tracking: ${assetLabel}.
${assetProfile ? `\nABOUT THIS ASSET: ${assetProfile}\n` : ''}${newsContext ? `\nCURRENT NEWS (prioritise markets related to these themes):\n${newsContext}\n` : ''}
YOUR TASK: From the candidate markets below, select up to ${marketLimit} that are DIVERSE, RELEVANT, and NON-DUPLICATIVE.

━━━ STEP 1: NARRATIVE GROUPING (this is the most important step) ━━━

Group markets by their UNDERLYING NARRATIVE — the real-world story or event they relate to. Two markets are part of the SAME narrative if:
- They involve the same person in the same role (even with different dates/thresholds)
- They are different angles on the same event (confirmation vs departure vs withdrawal)
- They track the same metric with different targets (price > X vs price > Y)
- One is a precondition or consequence of the other

EXAMPLES — all of these are ONE narrative each, pick only ONE market from each:
- "Will Kevin Warsh be confirmed as Fed Chair?" / "Kevin Warsh confirmed by May 1?" / "Jerome Powell out from Fed Board by May 30?" / "Kevin Warsh nomination withdrawn by May 15?" → ALL ONE NARRATIVE: "Fed Chair transition". Pick the single highest-volume one.
- "S&P 500 hit 7,050 in June?" / "SPY hit $660 Week of April 13?" / "S&P 500 close above 6,000?" → ALL ONE NARRATIVE: "S&P price targets". Pick one.
- "Will Bitcoin have best performance in 2026?" / "BTC above 100k by June?" / "Bitcoin market cap passes gold?" → ALL ONE NARRATIVE: "Bitcoin performance". Pick one.
- "Trump announces tariffs by April 17?" / "New tariffs on China by May?" / "US-China trade deal by June?" → ALL ONE NARRATIVE: "trade war/tariffs". Pick one.
- "US recession by end of 2026?" / "GDP growth below 1%?" / "Unemployment above 5%?" → ALL ONE NARRATIVE: "recession risk". Pick one.

━━━ STEP 2: RELEVANCE FILTER ━━━

For each narrative group, ask: "Does this SPECIFICALLY and DIRECTLY affect ${assetLabel}'s price?"

REJECT if:
- The market is about a DIFFERENT ASSET CLASS entirely. Examples of what to reject:
  • Bitcoin/crypto markets when ${assetLabel} is a stock or index (unless it literally mentions ${assetLabel})
  • Oil/energy markets when ${assetLabel} is a tech stock
  • Stock index markets when ${assetLabel} is a cryptocurrency
- The connection is vague or requires 3+ logical leaps ("Fed Chair → interest rates → maybe affects stocks somehow" is TOO VAGUE for individual stocks; it's borderline acceptable for broad market indices like S&P 500)
- The market is about a generic macro theme (GDP, recession, inflation, Fed policy) and ${assetLabel} is an individual stock — these belong on index dashboards, not stock dashboards

━━━ STEP 3: SELECTION ━━━

From the surviving narrative groups, pick the SINGLE best market from each group (highest 24h volume = most liquid/interesting). Return up to ${marketLimit} total, prioritising:
1. Markets that literally name ${assetLabel} (earnings, products, lawsuits, leadership)
2. Markets about ${assetLabel}'s specific sector
3. Markets about ${assetLabel}'s geographic exposure
4. Markets about named competitors or partners
5. Broad macro — but MAXIMUM 1 macro market total, and only if ${assetLabel} is a broad index

FINAL CHECKS before returning:
- Count how many narratives you selected. If two selections are really the same story told differently, DROP one.
- If you have fewer than ${marketLimit} good matches, that's fine. Return fewer. An empty array [] is better than irrelevant padding.

Markets:
${candidateList}

Return ONLY a JSON array of the index numbers you selected, e.g. [0, 3, 7]. No explanation, no other text.`

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
    .slice(0, marketLimit)
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

