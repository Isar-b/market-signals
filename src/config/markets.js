// tokenId starts as null — resolved at runtime via resolveTokenIds()
// polymarketSlug is used to look up the real tokenId from the Gamma API

export const MARKETS = {

  // ─── S&P 500 ──────────────────────────────────────────────────────────────
  SP500: [
    {
      id: 'fed-april-25bps',
      label: 'Fed cuts 25bps in April 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2026-meeting',
      tokenId: null,
    },
    {
      id: 'fed-cuts-2026',
      label: 'No Fed rate cuts in 2026',
      polymarketSlug: 'will-no-fed-rate-cuts-happen-in-2026',
      tokenId: null,
    },
    {
      id: 'us-recession-2026',
      label: 'US recession by end of 2026',
      polymarketSlug: 'us-recession-by-end-of-2026',
      tokenId: null,
    },
    {
      id: 'fed-june-25bps',
      label: 'Fed cuts 25bps in June 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-june-2026-meeting',
      tokenId: null,
    },
  ],

  // ─── Nasdaq 100 ───────────────────────────────────────────────────────────
  NDX: [
    {
      id: 'fed-april-25bps',
      label: 'Fed cuts 25bps in April 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2026-meeting',
      tokenId: null,
    },
    {
      id: 'us-recession-2026',
      label: 'US recession by end of 2026',
      polymarketSlug: 'us-recession-by-end-of-2026',
      tokenId: null,
    },
    {
      id: 'nvda-largest-june',
      label: 'Nvidia largest company by June 30',
      polymarketSlug: 'will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-june-30-824',
      tokenId: null,
    },
    {
      id: 'spacex-ipo-2027',
      label: 'SpaceX IPO before 2027',
      polymarketSlug: 'spacex-space-exploration-technologies-corp-ipo-before-2027',
      tokenId: null,
    },
  ],

  // ─── Brent crude ─────────────────────────────────────────────────────────
  OIL: [
    {
      id: 'iran-forces-apr',
      label: 'US forces enter Iran by April 30',
      polymarketSlug: 'us-forces-enter-iran-by-april-30-899',
      tokenId: null,
    },
    {
      id: 'hormuz-apr',
      label: 'Hormuz traffic normal by April 30',
      polymarketSlug: 'strait-of-hormuz-traffic-returns-to-normal-by-april-30',
      tokenId: null,
      expiresApprox: '2026-04-30',
      fallbackSlug: 'strait-of-hormuz-traffic-returns-to-normal-by-end-of-may',
    },
    {
      id: 'hormuz-may',
      label: 'Hormuz traffic normal by May 31',
      polymarketSlug: 'strait-of-hormuz-traffic-returns-to-normal-by-end-of-may',
      tokenId: null,
      expiresApprox: '2026-05-31',
    },
    {
      id: 'kharg-island',
      label: 'Kharg Island not under Iranian control by June 30',
      polymarketSlug: null, // resolved via keyword search at startup
      tokenId: null,
      keywordSearch: 'kharg',
    },
  ],

  // ─── Gold ─────────────────────────────────────────────────────────────────
  GOLD: [
    {
      id: 'gold-6000-june',
      label: 'Gold hits $6,000/oz by end of June',
      polymarketSlug: 'gc-hit-6000-high-jun-2026-148-914-853',
      tokenId: null,
    },
    {
      id: 'gold-6200-june',
      label: 'Gold hits $6,200/oz by end of June',
      polymarketSlug: 'gc-hit-6200-high-jun-2026-163-341-565',
      tokenId: null,
    },
    {
      id: 'fed-april-25bps',
      label: 'Fed cuts 25bps in April 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2026-meeting',
      tokenId: null,
    },
    {
      id: 'us-recession-2026',
      label: 'US recession by end of 2026',
      polymarketSlug: 'us-recession-by-end-of-2026',
      tokenId: null,
    },
  ],

  // ─── Tesla ────────────────────────────────────────────────────────────────
  TSLA: [
    {
      id: 'tsla-deliveries-q1',
      label: 'Tesla Q1 deliveries 350k–375k',
      polymarketSlug: 'will-tesla-deliver-between-350000-and-375000-vehicles-in-q1-2026',
      tokenId: null,
    },
    {
      id: 'tsla-spacex-merger',
      label: 'Tesla–SpaceX merger by June 30',
      polymarketSlug: 'tesla-and-spacex-merger-officially-announced-by-june-30',
      tokenId: null,
    },
    {
      id: 'spacex-ipo-2027',
      label: 'SpaceX IPO before 2027',
      polymarketSlug: 'spacex-space-exploration-technologies-corp-ipo-before-2027',
      tokenId: null,
    },
    {
      id: 'tsla-xai-merger',
      label: 'Tesla–xAI merger by June 30',
      polymarketSlug: 'tesla-and-xai-merger-officially-announced-by-june-30',
      tokenId: null,
    },
  ],

  // ─── Nvidia ───────────────────────────────────────────────────────────────
  NVDA: [
    {
      id: 'nvda-largest-june',
      label: 'Nvidia largest company by June 30',
      polymarketSlug: 'will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-june-30-824',
      tokenId: null,
    },
    {
      id: 'nvda-largest-dec',
      label: 'Nvidia largest company by Dec 31 2026',
      polymarketSlug: 'will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-december-31-244',
      tokenId: null,
    },
    {
      id: 'spacex-ipo-2027',
      label: 'SpaceX IPO before 2027',
      polymarketSlug: 'spacex-space-exploration-technologies-corp-ipo-before-2027',
      tokenId: null,
    },
    {
      id: 'us-recession-2026',
      label: 'US recession by end of 2026',
      polymarketSlug: 'us-recession-by-end-of-2026',
      tokenId: null,
    },
  ],

  // ─── Microsoft ────────────────────────────────────────────────────────────
  MSFT: [
    {
      id: 'openai-ipo-marketcap',
      label: 'OpenAI IPO market cap above $800bn',
      polymarketSlug: 'openai-ipo-closing-market-cap-above-800b',
      tokenId: null,
    },
    {
      id: 'spacex-ipo-2027',
      label: 'SpaceX IPO before 2027',
      polymarketSlug: 'spacex-space-exploration-technologies-corp-ipo-before-2027',
      tokenId: null,
    },
    {
      id: 'nvda-largest-june',
      label: 'Nvidia largest company by June 30',
      polymarketSlug: 'will-nvidia-be-the-largest-company-in-the-world-by-market-cap-on-june-30-824',
      tokenId: null,
    },
    {
      id: 'fed-april-25bps',
      label: 'Fed cuts 25bps in April 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2026-meeting',
      tokenId: null,
    },
  ],

  // ─── Apple ────────────────────────────────────────────────────────────────
  AAPL: [
    {
      id: 'openai-ipo-2027',
      label: 'OpenAI IPO before 2027',
      polymarketSlug: 'openai-ipo-before-2027',
      tokenId: null,
    },
    {
      id: 'aapl-largest-june',
      label: 'Apple largest company by June 30',
      polymarketSlug: 'will-apple-be-the-largest-company-in-the-world-by-market-cap-on-june-30-416',
      tokenId: null,
    },
    {
      id: 'fed-april-25bps',
      label: 'Fed cuts 25bps in April 2026',
      polymarketSlug: 'will-the-fed-decrease-interest-rates-by-25-bps-after-the-april-2026-meeting',
      tokenId: null,
    },
    {
      id: 'us-recession-2026',
      label: 'US recession by end of 2026',
      polymarketSlug: 'us-recession-by-end-of-2026',
      tokenId: null,
    },
  ],
}

// Shared market IDs — these appear under multiple assets
// Used for deduplication: fetch each tokenId's price only once per poll cycle
export const SHARED_MARKET_IDS = [
  'fed-april-25bps',
  'fed-june-25bps',
  'us-recession-2026',
  'nvda-largest-june',
  'spacex-ipo-2027',
]
