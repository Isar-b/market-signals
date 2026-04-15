export const DEFAULT_ASSETS = [
  { id: 'SP500',      label: 'S&P 500',       yahooSymbol: '^GSPC' },
  { id: 'SP500_HL',   label: 'S&P 500 24h',   hlSymbol: 'xyz:SP500',    source: 'hyperliquid' },
  { id: 'NDX',        label: 'Nasdaq 100',     yahooSymbol: '^NDX'  },
  { id: 'OIL',        label: 'Brent crude',    yahooSymbol: 'BZ=F'  },
  { id: 'OIL_HL',     label: 'Brent Oil 24h',  hlSymbol: 'xyz:BRENTOIL', source: 'hyperliquid' },
  { id: 'GOLD',       label: 'Gold',           yahooSymbol: 'GC=F'  },
  { id: 'BTC',        label: 'Bitcoin',        hlSymbol: 'BTC',          source: 'hyperliquid' },
  { id: 'ETH',        label: 'Ethereum',       hlSymbol: 'ETH',          source: 'hyperliquid' },
  { id: 'TSLA',       label: 'Tesla',          yahooSymbol: 'TSLA'  },
  { id: 'NVDA',       label: 'Nvidia',         yahooSymbol: 'NVDA'  },
  { id: 'MSFT',       label: 'Microsoft',      yahooSymbol: 'MSFT'  },
  { id: 'AAPL',       label: 'Apple',          yahooSymbol: 'AAPL'  },
]

// Map HL asset IDs to their Yahoo counterpart for reusing prediction market patterns
export const HL_TO_MARKET_ID = {
  SP500_HL: 'SP500',
  OIL_HL: 'OIL',
}

const INDEX_IDS = new Set(['SP500', 'SP500_HL', 'NDX', 'OIL', 'OIL_HL', 'GOLD', 'BTC', 'ETH'])
export const isIndexAsset = (id) => INDEX_IDS.has(id)
