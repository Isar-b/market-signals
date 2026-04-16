import { useStockSummary } from '../hooks/useStockSummary'

function fmt(n, opts = {}) {
  if (n == null) return '—'
  if (opts.pct) return `${(n * 100).toFixed(1)}%`
  if (opts.ratio) return `${n.toFixed(1)}x`
  if (opts.usd) {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
    return `$${n.toLocaleString()}`
  }
  if (opts.eps) return `$${n.toFixed(2)}`
  return String(n)
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatQuarter(d) {
  if (!d) return ''
  const date = new Date(d)
  const q = Math.ceil((date.getMonth() + 1) / 3)
  return `Q${q} ${date.getFullYear()}`
}

function Row({ label, value, className = '' }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-xs font-semibold text-text-primary ${className}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2">{title}</h3>
      <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export default function StockPanel({ asset, enabled }) {
  const { data, loading, error } = useStockSummary(asset?.yahooSymbol, enabled)

  if (!enabled) return null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-full max-w-xs bg-bg-primary rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-accent rounded-full animate-pulse w-1/2" />
        </div>
        <p className="text-sm text-text-secondary text-center animate-pulse">
          Loading stock data...
        </p>
      </div>
    )
  }

  if (error) return <div className="text-red text-sm py-4">Failed to load stock data: {error}</div>
  if (!data) return null

  const recColors = { buy: 'text-green', hold: 'text-yellow-400', sell: 'text-red', 'strong_buy': 'text-green', 'strong_sell': 'text-red' }
  const recLabels = { buy: 'Buy', hold: 'Hold', sell: 'Sell', strong_buy: 'Strong Buy', strong_sell: 'Strong Sell', underperform: 'Underperform', outperform: 'Outperform' }

  return (
    <div className="flex flex-col gap-3">
      {/* About */}
      {(data.sector || data.summary) && (
        <Section title="About">
          {data.sector && (
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">{data.sector}</span>
              {data.industry && <span className="text-[10px] text-text-secondary ml-1.5">{data.industry}</span>}
            </div>
          )}
          {data.summary && (
            <div className="px-3 py-2 text-[11px] text-text-secondary leading-relaxed">
              {data.summary}
            </div>
          )}
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-accent hover:text-accent-hover transition-colors border-t border-border"
            >
              Company Website &rarr;
            </a>
          )}
        </Section>
      )}

      {/* Valuation */}
      <Section title="Valuation">
        <Row label="Forward P/E" value={fmt(data.forwardPE, { ratio: true })} />
        <Row label="Trailing P/E" value={fmt(data.trailingPE, { ratio: true })} />
        <Row label="Price / Book" value={fmt(data.priceToBook, { ratio: true })} />
        <Row label="EV / Revenue" value={fmt(data.evToRevenue, { ratio: true })} />
      </Section>

      {/* Earnings */}
      {(data.earningsHistory?.length > 0 || data.nextEarningsDate) && (
        <Section title="Earnings">
          {data.nextEarningsDate && (
            <div className="px-3 py-2 border-b border-border">
              <div className="text-[10px] text-text-secondary">Next Earnings</div>
              <div className="text-xs font-semibold text-text-primary">
                {formatDate(data.nextEarningsDate)}
                {data.nextEarningsEstimate != null && (
                  <span className="text-text-secondary font-normal ml-2">Est. {fmt(data.nextEarningsEstimate, { eps: true })}</span>
                )}
              </div>
            </div>
          )}
          {data.earningsHistory?.map((e, i) => {
            const beat = e.actual != null && e.estimate != null && e.actual > e.estimate
            const miss = e.actual != null && e.estimate != null && e.actual < e.estimate
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-b-0">
                <span className="text-xs text-text-secondary">{formatQuarter(e.quarter)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-secondary">Est. {fmt(e.estimate, { eps: true })}</span>
                  <span className={`text-xs font-semibold ${beat ? 'text-green' : miss ? 'text-red' : 'text-text-primary'}`}>
                    {fmt(e.actual, { eps: true })}
                  </span>
                  {beat && <span className="text-[9px] font-bold text-green">BEAT</span>}
                  {miss && <span className="text-[9px] font-bold text-red">MISS</span>}
                </div>
              </div>
            )
          })}
        </Section>
      )}

      {/* Financials */}
      <Section title="Financials">
        <Row label="Revenue" value={fmt(data.revenue, { usd: true })} />
        <Row label="Revenue Growth" value={fmt(data.revenueGrowth, { pct: true })} className={data.revenueGrowth > 0 ? 'text-green' : data.revenueGrowth < 0 ? 'text-red' : ''} />
        <Row label="Gross Margin" value={fmt(data.grossMargins, { pct: true })} />
        <Row label="Profit Margin" value={fmt(data.profitMargins, { pct: true })} />
        <Row label="Free Cash Flow" value={fmt(data.freeCashflow, { usd: true })} />
      </Section>

      {/* Short Interest */}
      {(data.shortPercentOfFloat != null || data.shortRatio != null) && (
        <Section title="Short Interest">
          <Row label="Short % of Float" value={fmt(data.shortPercentOfFloat, { pct: true })} />
          <Row label="Days to Cover" value={data.shortRatio != null ? `${data.shortRatio.toFixed(1)}` : '—'} />
        </Section>
      )}

      {/* Analysts */}
      {data.recommendation && (
        <Section title="Analysts">
          <Row label="Consensus" value={recLabels[data.recommendation] || data.recommendation} className={recColors[data.recommendation] || ''} />
          <Row label="Price Target" value={data.targetMedian != null ? `$${data.targetLow} / $${Math.round(data.targetMedian)} / $${data.targetHigh}` : '—'} />
          <Row label="# Analysts" value={data.analystCount || '—'} />
        </Section>
      )}

      <p className="text-[9px] text-text-secondary/50 text-center mt-1">
        Source: Yahoo Finance
      </p>
    </div>
  )
}
