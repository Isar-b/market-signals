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

function deduplicateCandidates(candidates, assetName) {
  const result = []
  const seenNormalized = new Set()

  for (const m of candidates) {
    const q = m.question.toLowerCase()

    if (/largest company.*market cap/i.test(q) || /market cap.*largest/i.test(q)) {
      const isAboutOurAsset = assetName.split(/\s+/).some(word =>
        word.length >= 3 && q.includes(word.toLowerCase())
      )
      if (!isAboutOurAsset) continue
    }

    const normalized = q
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '_DATE_')
      .replace(/\b20\d{2}\b/g, '_YEAR_')
      .replace(/\b\d{1,2}(st|nd|rd|th)?\b/g, '_D_')
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
- The company/asset name and ticker
- Direct competitors and partners
- Key people (CEO, founders)
- Industry-specific terms
- Geographic markets (e.g. "UK", "China", "Europe")
- Relevant indices (e.g. "FTSE", "Nasdaq")
- Relevant currencies (e.g. "pound", "sterling", "euro")
- Regulatory bodies (e.g. "FCA", "SEC", "EU")
- Sector terms (e.g. "semiconductor", "cloud", "oil")

Return 15-25 keywords. Only return the JSON, no other text.`
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

async function selectWithLLM(candidates, assetId, assetLabel, assetProfile) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured')

  assetLabel = assetLabel || ASSET_LABELS[assetId] || assetId
  const candidateList = candidates.map((m, i) =>
    `${i}. "${m.question}" (24h vol: $${Math.round(Number(m.volume24hr || 0)).toLocaleString()})`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are selecting prediction markets for a financial dashboard. The user is tracking: ${assetLabel}.
${assetProfile ? `\nABOUT THIS ASSET: ${assetProfile}\n` : ''}
Select exactly 10 markets from the list below, ranked most to least relevant.

SELF-CHECK: For each market you consider, ask: "Would a portfolio manager holding ${assetLabel} check this market daily?" If no, skip it.

PRIORITY ORDER:
1. Markets DIRECTLY about ${assetLabel} itself (price targets, earnings, products, leadership, M&A)
2. Markets about ${assetLabel}'s direct competitors, partners, or supply chain (e.g. OpenAI for Microsoft, TSMC for Nvidia)
3. Markets about the specific sector/industry ${assetLabel} operates in
4. Macro events with a DIRECT causal link to ${assetLabel} (e.g. Fed rates for banks, tariffs for importers)

HARD EXCLUSIONS — never include these:
- Cryptocurrency, blockchain, or token markets (unless ${assetLabel} IS a crypto asset)
- Markets about companies unrelated to ${assetLabel} (e.g. SpaceX for Microsoft, Tesla for Apple)
- "Largest company by market cap" about any company OTHER than ${assetLabel}
- Generic macro that affects all stocks equally (Fed Chair appointments, Bank of Japan, GDP) — ONLY include if nothing better is available
- Near-duplicate markets (same question, different dates) — pick nearest future date only

DIVERSITY: Cover 10 different themes. Never pick 2+ markets on the same narrow topic.

Markets:
${candidateList}

Return ONLY a JSON array of 10 indices, e.g. [0, 3, 7, 12, 15, 20, 25, 30, 35, 40]. No other text.`
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
    .slice(0, 10)
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
        Array.from({ length: 10 }, (_, i) =>
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
        label.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 3 && !['inc', 'ltd', 'corp', 'the', 'and', 'com', 'plc', 'ord'].includes(w.toLowerCase()))
          .forEach(w => dynamicPatterns.push(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')))
      }
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

    // Cap candidates sent to LLM
    candidates = candidates.slice(0, 60)

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

    // Cap at 5 final markets
    selected = selected.slice(0, 5)

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
