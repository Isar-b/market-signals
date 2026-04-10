import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function ProbabilityChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-text-secondary text-xs py-4">No history data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tickFormatter={(val) => {
            const d = new Date(val)
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }}
          stroke="#4a5568"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          minTickGap={30}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(val) => `${Math.round(val * 100)}%`}
          stroke="#4a5568"
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#232740',
            border: '1px solid #2a2e45',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: 12,
          }}
          formatter={(val) => [`${(val * 100).toFixed(1)}%`, 'Probability']}
          labelFormatter={(val) => new Date(val).toLocaleDateString()}
        />
        <Line
          type="monotone"
          dataKey="probability"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: '#6366f1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
