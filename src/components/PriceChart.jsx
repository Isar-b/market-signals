import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function PriceChart({ data, horizon }) {
  if (!data || data.length === 0) return null

  const first = data[0].close
  const last = data[data.length - 1].close
  const color = last >= first ? '#22c55e' : '#ef4444'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(val) => formatXTick(val, horizon)}
          stroke="#4a5568"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          stroke="#4a5568"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(val) => formatPrice(val)}
          width={65}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#232740',
            border: '1px solid #2a2e45',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: 13,
          }}
          labelFormatter={(val) => {
            const d = new Date(val)
            return horizon === '1D'
              ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          }}
          formatter={(val) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={color}
          strokeWidth={2}
          fill="url(#colorClose)"
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function formatXTick(val, horizon) {
  const d = new Date(val)
  switch (horizon) {
    case '1D':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    case '1W':
      return d.toLocaleDateString('en-US', { weekday: 'short' })
    case 'YTD':
    case '1Y':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'MAX':
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    default:
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function formatPrice(val) {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  return `$${val.toFixed(val < 10 ? 2 : 0)}`
}
