// Centralized cache TTLs — change in one place, applies everywhere
export const CACHE_TTL_POLYMARKET = 5 * 60 * 1000   // 5 min — Polymarket data + per-asset market results
export const CACHE_TTL_NEWS      = 15 * 60 * 1000   // 15 min — TheNewsAPI articles
export const CACHE_TTL_STOCK     = 15 * 60 * 1000   // 15 min — Yahoo Finance quoteSummary
export const CACHE_TTL_FRED      = 60 * 60 * 1000   // 1 hour — FRED economic data (updates monthly)
