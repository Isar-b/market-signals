export const HORIZONS = [
  { id: '1D',  label: '1D'  },
  { id: '1W',  label: '1W'  },
  { id: '1M',  label: '1M'  },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y',  label: '1Y'  },
  { id: 'MAX', label: 'Max' },
]

// Maps horizon ID to Polymarket prices-history params
export const POLY_INTERVAL_MAP = {
  '1D':  { interval: 'max', fidelity: 60   },
  '1W':  { interval: 'max', fidelity: 360  },
  '1M':  { interval: 'max', fidelity: 1440 },
  'YTD': { interval: 'max', fidelity: 1440 },
  '1Y':  { interval: 'max', fidelity: 1440 },
  'MAX': { interval: 'max', fidelity: 1440 },
}

// Compute startTs/endTs unix timestamps for a given horizon
export function getPolyTimestamps(horizonId) {
  const now = Math.floor(Date.now() / 1000)
  const DAY = 86400

  switch (horizonId) {
    case '1D':  return { startTs: now - DAY,       endTs: now }
    case '1W':  return { startTs: now - 7 * DAY,   endTs: now }
    case '1M':  return { startTs: now - 30 * DAY,  endTs: now }
    case 'YTD': {
      const jan1 = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)
      return { startTs: jan1, endTs: now }
    }
    case '1Y':  return { startTs: now - 365 * DAY, endTs: now }
    case 'MAX': return { startTs: now - 3650 * DAY, endTs: now }
    default:    return { startTs: now - 365 * DAY, endTs: now }
  }
}
