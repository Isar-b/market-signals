import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
import { CACHE_TTL_STOCK } from '../lib/constants.js'

const CACHE_TTL = CACHE_TTL_STOCK
const cache = new Map()

export default async function handler(req, res) {
  try {
    const { symbol } = req.query
    if (!symbol) return res.status(400).json({ error: 'symbol required' })

    const cached = cache.get(symbol)
    if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json(cached.data)

    const q = await yf.quoteSummary(symbol, {
      modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics', 'earningsHistory', 'calendarEvents'],
    })

    const profile = q.summaryProfile || {}
    const fin = q.financialData || {}
    const stats = q.defaultKeyStatistics || {}
    const earnings = q.earningsHistory?.history || []
    const calendar = q.calendarEvents?.earnings || {}

    const result = {
      // About
      sector: profile.sector || null,
      industry: profile.industry || null,
      summary: profile.longBusinessSummary
        ? profile.longBusinessSummary.substring(0, 300) + (profile.longBusinessSummary.length > 300 ? '...' : '')
        : null,
      employees: profile.fullTimeEmployees || null,
      website: profile.website || null,

      // Valuation
      forwardPE: stats.forwardPE || null,
      trailingPE: (fin.currentPrice && stats.trailingEps) ? +(fin.currentPrice / stats.trailingEps).toFixed(1) : null,
      priceToBook: stats.priceToBook ? +stats.priceToBook.toFixed(1) : null,
      evToRevenue: stats.enterpriseToRevenue ? +stats.enterpriseToRevenue.toFixed(1) : null,

      // Earnings history (last 4 quarters)
      earningsHistory: earnings.map(e => ({
        quarter: e.quarter,
        actual: e.epsActual,
        estimate: e.epsEstimate,
        surprise: e.surprisePercent,
      })),
      // Next earnings
      nextEarningsDate: calendar.earningsDate?.[0] || null,
      nextEarningsEstimate: calendar.earningsAverage || null,

      // Financials
      revenue: fin.totalRevenue || null,
      revenueGrowth: fin.revenueGrowth || null,
      grossMargins: fin.grossMargins || null,
      profitMargins: fin.profitMargins || null,
      freeCashflow: fin.freeCashflow || null,

      // Short interest
      shortPercentOfFloat: stats.shortPercentOfFloat || null,
      shortRatio: stats.shortRatio || null,

      // Analysts
      recommendation: fin.recommendationKey || null,
      targetLow: fin.targetLowPrice || null,
      targetMedian: fin.targetMedianPrice || null,
      targetHigh: fin.targetHighPrice || null,
      analystCount: fin.numberOfAnalystOpinions || null,
    }

    cache.set(symbol, { data: result, ts: Date.now() })
    res.json(result)
  } catch (err) {
    console.error('Stock summary error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
