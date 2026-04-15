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
  BTC:   [/\bbitcoin\b/i, /\bbtc\b/i, /\bcrypto\b/i, /\bhalving\b/i, /\bsatoshi\b/i, /\bblockchain\b/i],
  ETH:   [/\bethereum\b/i, /\beth\b(?!anol)/i, /\bdefi\b/i, /\bvitalik\b/i, /\bstaking\b/i, /\blayer.?2\b/i],
  TSLA:  [/tesla/i, /\btsla\b/i, /\bmusk\b/i, /spacex/i, /\bxai\b/i, /electric vehicle/i],
  NVDA:  [/nvidia/i, /\bnvda\b/i, /semiconductor/i, /\bgpu\b/i],
  MSFT:  [/microsoft/i, /\bmsft\b/i, /openai/i, /\bazure\b/i],
  AAPL:  [/\bapple\b(?! ?bee)/i, /\baapl\b/i, /iphone/i, /app store/i],
}
// HL aliases reuse the same patterns as their Yahoo counterparts
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

// ─── Helper functions ──────────────────────────────────────────────────────

function deduplicateCandidates(candidates, assetName) {
  const result = []
  const seenNormalized = new Set()

  for (const m of candidates) {
    const q = m.question
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+(?:[- ][A-Z][a-z]+)*/g, '_NAME_')
      .toLowerCase()

    if (/largest company.*market cap/i.test(q) || /market cap.*largest/i.test(q)) {
      const isAboutOurAsset = assetName.split(/\s+/).some(word =>
        word.length >= 3 && q.includes(word.toLowerCase())
      )
      if (!isAboutOurAsset) continue
    }

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
    return { description: text, keywords: [] }
  }
}

// ─── TheNewsAPI helpers ────────────────────────────────────────────────────
const newsCache = new Map()
const NEWS_CACHE_TTL = 15 * 60 * 1000

const NEWS_SEARCH_OVERRIDES = {
  SP500:    '"S&P 500" | "stock market" | "Wall Street"',
  SP500_HL: '"S&P 500" | "stock market" | "Wall Street"',
  NDX:      '"Nasdaq" | "tech stocks"',
  OIL:      '"crude oil" | "Brent" | "OPEC" | "oil price"',
  OIL_HL:   '"crude oil" | "Brent" | "OPEC" | "oil price"',
  GOLD:     '"gold price" | "gold" | "precious metals"',
  BTC:      '"Bitcoin" | "BTC" | "crypto"',
  ETH:      '"Ethereum" | "ETH" | "DeFi"',
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
    sort: 'published_at',
    limit: '5',
  })

  const resp = await fetch(`https://api.thenewsapi.com/v1/news/all?${params}`)
  if (!resp.ok) throw new Error(`News API returned ${resp.status}`)
  const json = await resp.json()

  const articles = (json.data || []).map(a => ({
    title: a.title,
    url: a.url,
    source: a.source,
    snippet: a.snippet || a.description || '',
    publishedAt: a.published_at,
    imageUrl: a.image_url,
  }))

  newsCache.set(cacheKey, { data: articles, ts: Date.now() })
  return articles
}

function formatNewsContext(articles) {
  if (!articles || articles.length === 0) return ''
  return articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.source}, ${new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`)
    .join('\n')
}

async function selectWithLLM(candidates, assetId, assetLabel, assetProfile, marketLimit = 5, newsContext = '') {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured')

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
    .slice(0, marketLimit)
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
      } catch (err) {
        console.error('Asset profile failed:', err.message)
      }
    }

    // 3b. Get current news context via TheNewsAPI (all assets)
    let newsContext = ''
    try {
      const articles = await fetchNewsArticles(asset, assetLabel)
      newsContext = formatNewsContext(articles)
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
        label.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3
            && !['inc', 'ltd', 'corp', 'the', 'and', 'com', 'plc', 'ord', 'new', 'index', 'fund', 'trust', 'group', 'jones', 'standard', 'poor', 'average', 'composite', 'holdings', 'global'].includes(w.toLowerCase())
            && !/^\d+$/.test(w))
          .forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
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

    const assetName = (label || ASSET_LABELS[asset] || asset).toLowerCase()
    candidates = deduplicateCandidates(candidates, assetName)

    // Sort: asset-specific matches first, then macro/generic
    candidates.sort((a, b) => {
      const aText = a.question + ' ' + (a.description || '')
      const bText = b.question + ' ' + (b.description || '')
      const aSpecific = assetPatterns.some(p => p.test(aText)) ? 1 : 0
      const bSpecific = assetPatterns.some(p => p.test(bText)) ? 1 : 0
      return bSpecific - aSpecific
    })

    // Remove sports/entertainment noise unless the asset is sports-related
    const SPORTS_RE = /\bvs\.?\s|\b(nba|nfl|mlb|nhl|epl|premier league|la liga|serie a|bundesliga|champions league|world cup|goal scorer|touchdown|home run|slam dunk|win .* series|bout|ufc|wwe|grand prix|formula 1|f1 race|win .*season|subscribers|lcs|lec|valorant|esport|league of legends)\b/i
    candidates = candidates.filter(m => !SPORTS_RE.test(m.question))

    // Remove election/political noise (unless asset is specifically political/geopolitical)
    const ELECTION_RE = /\b(win the most seats|parliamentary election|presidential election|win the national list|Nobel Peace Prize|leader of .* end of)\b/i
    candidates = candidates.filter(m => !ELECTION_RE.test(m.question))

    // Cap candidates sent to LLM
    candidates = candidates.slice(0, 60)

    // 5. LLM selection
    let selected
    if (candidates.length <= marketLimit) {
      selected = candidates
    } else {
      try {
        selected = await selectWithLLM(candidates, asset, assetLabel, assetProfile, marketLimit, newsContext)
      } catch (err) {
        console.error('LLM selection failed:', err.message)
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
