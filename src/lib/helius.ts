import { HELIUS_RPC, POOLS, DECIMALS } from './constants'

let rpcId = 1
function nextId() { return rpcId++ }

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
  })
  const json = await res.json()
  if (json.error) {
    const msg = JSON.stringify(json.error)
    // Detect rate limit — Helius returns code -32005 or mentions "Too many"
    if (json.error.code === -32005 || msg.toLowerCase().includes('too many') || msg.includes('429')) {
      const err = new Error('RATE_LIMIT') as Error & { isRateLimit: boolean }
      err.isRateLimit = true
      throw err
    }
    throw new Error(`RPC ${method}: ${msg}`)
  }
  return json.result
}

// ─── Live market data ────────────────────────────────────────────────────────

export interface PoolState {
  solLamports: number
  tokenAmount: number
}

export interface MarketData {
  crime: PoolState
  fraud: PoolState
  crimeSupply: number
  fraudSupply: number
  solUsdPrice: number
  timestamp: number
}

export interface MarketcapResult {
  mcSol: number
  mcUsd: number
  crimeMcUsd: number
  fraudMcUsd: number
  crimePriceSol: number
  fraudPriceSol: number
  crimePriceUsd: number
  fraudPriceUsd: number
}

async function getSolVaultBalance(pubkey: string): Promise<number> {
  const result = await rpc('getBalance', [pubkey, { commitment: 'confirmed' }])
  return result.value as number
}

async function getTokenVaultBalance(pubkey: string): Promise<number> {
  const result = await rpc('getTokenAccountBalance', [pubkey, { commitment: 'confirmed' }])
  return Number(result.value.amount)
}

async function getTokenSupply(mint: string): Promise<number> {
  const result = await rpc('getTokenSupply', [mint, { commitment: 'confirmed' }])
  return Number(result.value.uiAmount)
}

let cachedSolPrice = 88
let solPriceFetchedAt = 0

export async function getSolUsdPrice(): Promise<number> {
  const now = Date.now()
  if (cachedSolPrice && now - solPriceFetchedAt < 30_000) return cachedSolPrice
  try {
    const res = await fetch('/api/sol-price', { cache: 'no-store' })
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    if (data.price && typeof data.price === 'number') {
      cachedSolPrice = data.price
      solPriceFetchedAt = now
    }
  } catch (err) {
    console.warn('[getSolUsdPrice] failed, using cached:', cachedSolPrice, err)
  }
  return cachedSolPrice
}

// PROFIT staking vault token account
const PROFIT_STAKING_VAULT = '9knYFeYSupqdhQv6yyMv6q1FGpD5L3q3yaym7N5Lwafo'
const PROFIT_TOTAL_SUPPLY   = 20_000_000

export interface StakingData {
  stakedAmount: number  // UI units (already divided by 1e6)
  stakedPct: number     // 0–100
  stakerCount: number   // 104 on-chain staker records (static for now)
}

export async function fetchStakingData(): Promise<StakingData> {
  const result = await rpc('getTokenAccountBalance', [PROFIT_STAKING_VAULT, { commitment: 'confirmed' }])
  const stakedAmount = Number(result.value.uiAmount)
  const stakedPct = (stakedAmount / PROFIT_TOTAL_SUPPLY) * 100
  return { stakedAmount, stakedPct, stakerCount: 104 }
}

export async function fetchMarketData(): Promise<MarketData> {
  const [crimeSolLamports, crimeTokenRaw, fraudSolLamports, fraudTokenRaw, crimeSupply, fraudSupply, solUsdPrice] =
    await Promise.all([
      getSolVaultBalance(POOLS.CRIME_SOL.solVault),
      getTokenVaultBalance(POOLS.CRIME_SOL.tokenVault),
      getSolVaultBalance(POOLS.FRAUD_SOL.solVault),
      getTokenVaultBalance(POOLS.FRAUD_SOL.tokenVault),
      getTokenSupply('cRiMEhAxoDhcEuh3Yf7Z2QkXUXUMKbakhcVqmDsqPXc'),
      getTokenSupply('FraUdp6YhtVJYPxC2w255yAbpTsPqd8Bfhy9rC56jau5'),
      getSolUsdPrice(),
    ])
  return {
    crime: { solLamports: crimeSolLamports, tokenAmount: crimeTokenRaw },
    fraud: { solLamports: fraudSolLamports, tokenAmount: fraudTokenRaw },
    crimeSupply, fraudSupply, solUsdPrice,
    timestamp: Date.now(),
  }
}

export function calcMarketcap(data: MarketData): MarketcapResult {
  const crimeSol = data.crime.solLamports / 1e9
  const crimeTokens = data.crime.tokenAmount / Math.pow(10, DECIMALS.CRIME)
  const fraudSol = data.fraud.solLamports / 1e9
  const fraudTokens = data.fraud.tokenAmount / Math.pow(10, DECIMALS.FRAUD)

  const crimePriceSol = crimeTokens > 0 ? crimeSol / crimeTokens : 0
  const fraudPriceSol = fraudTokens > 0 ? fraudSol / fraudTokens : 0
  const crimePriceUsd = crimePriceSol * data.solUsdPrice
  const fraudPriceUsd = fraudPriceSol * data.solUsdPrice

  const crimeMcUsd = crimePriceUsd * data.crimeSupply
  const fraudMcUsd = fraudPriceUsd * data.fraudSupply
  const mcUsd = crimeMcUsd + fraudMcUsd
  const mcSol = data.solUsdPrice > 0 ? mcUsd / data.solUsdPrice : 0

  return { mcSol, mcUsd, crimeMcUsd, fraudMcUsd, crimePriceSol, fraudPriceSol, crimePriceUsd, fraudPriceUsd }
}

// ─── OHLCV types ─────────────────────────────────────────────────────────────

export interface PricePoint {
  time: number    // unix seconds
  mcSol: number
  mcUsd: number
}

export interface OHLCVCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function buildCandles(points: PricePoint[], intervalSeconds: number): OHLCVCandle[] {
  if (points.length === 0) return []
  const map = new Map<number, OHLCVCandle>()

  for (const p of points) {
    const t = Math.floor(p.time / intervalSeconds) * intervalSeconds
    const c = map.get(t)
    if (!c) {
      map.set(t, { time: t, open: p.mcUsd, high: p.mcUsd, low: p.mcUsd, close: p.mcUsd, volume: 0 })
    } else {
      if (p.mcUsd > c.high) c.high = p.mcUsd
      if (p.mcUsd < c.low) c.low = p.mcUsd
      c.close = p.mcUsd
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time)
  if (sorted.length < 2) return sorted

  // Forward-fill gaps: intervals with no trades carry the previous close
  // This eliminates visual gaps and "floating dots" in the chart
  const filled: OHLCVCandle[] = []
  for (let i = 0; i < sorted.length; i++) {
    filled.push(sorted[i])
    if (i < sorted.length - 1) {
      const prevClose = sorted[i].close
      for (let t = sorted[i].time + intervalSeconds; t < sorted[i + 1].time; t += intervalSeconds) {
        filled.push({ time: t, open: prevClose, high: prevClose, low: prevClose, close: prevClose, volume: 0 })
      }
    }
  }

  return filled
}

// ─── Historical reconstruction ────────────────────────────────────────────────

interface VaultState {
  crimeSolLamports: number
  crimeTokenRaw: number
  fraudSolLamports: number
  fraudTokenRaw: number
}

function computeMcFromState(
  s: VaultState,
  crimeSupply: number,
  fraudSupply: number,
  solUsdPrice: number,
): number {
  if (s.crimeSolLamports <= 0 || s.crimeTokenRaw <= 0 || s.fraudSolLamports <= 0 || s.fraudTokenRaw <= 0) return 0
  const crimePrice = (s.crimeSolLamports / 1e9) / (s.crimeTokenRaw / Math.pow(10, DECIMALS.CRIME))
  const fraudPrice = (s.fraudSolLamports / 1e9) / (s.fraudTokenRaw / Math.pow(10, DECIMALS.FRAUD))
  return (crimePrice * crimeSupply + fraudPrice * fraudSupply) * solUsdPrice
}

/** Fetch ALL signatures for an address, paginated newest→oldest */
async function fetchAllSignatures(address: string): Promise<Array<{ sig: string; blockTime: number }>> {
  const all: Array<{ sig: string; blockTime: number }> = []
  let before: string | undefined

  while (true) {
    const params: unknown[] = [address, { limit: 200, commitment: 'confirmed' }]
    if (before) (params[1] as Record<string, unknown>).before = before

    const batch: Array<{ signature: string; blockTime: number | null; err: unknown }> = await rpc('getSignaturesForAddress', params)
    if (!batch || batch.length === 0) break

    for (const s of batch) {
      if (s.blockTime && !s.err) all.push({ sig: s.signature, blockTime: s.blockTime })
    }

    if (batch.length < 200) break
    before = batch[batch.length - 1].signature
    await new Promise(r => setTimeout(r, 100))
  }

  return all
}

/** Fetch a transaction and extract vault balance changes. Re-throws rate limit errors. */
async function fetchTxBalances(sig: string): Promise<{
  crimeSOLPre: number | null; crimeSOLPost: number | null
  crimeTokenPre: number | null; crimeTokenPost: number | null
  fraudSOLPre: number | null; fraudSOLPost: number | null
  fraudTokenPre: number | null; fraudTokenPost: number | null
} | null> {
  try {
    const tx = await rpc('getTransaction', [sig, {
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    }])
    if (!tx?.meta) return null

    const keys: string[] = tx.transaction.message.accountKeys.map(
      (k: { pubkey?: string } | string) => (typeof k === 'string' ? k : k.pubkey ?? String(k))
    )

    const crimeSOLIdx = keys.indexOf(POOLS.CRIME_SOL.solVault)
    const fraudSOLIdx = keys.indexOf(POOLS.FRAUD_SOL.solVault)

    const pre = tx.meta.preBalances as number[]
    const post = tx.meta.postBalances as number[]

    const preTB: Array<{ accountIndex: number; uiTokenAmount: { amount: string } }> = tx.meta.preTokenBalances ?? []
    const postTB: Array<{ accountIndex: number; uiTokenAmount: { amount: string } }> = tx.meta.postTokenBalances ?? []

    const tbPre = new Map<string, number>()
    const tbPost = new Map<string, number>()
    for (const t of preTB) tbPre.set(keys[t.accountIndex], Number(t.uiTokenAmount.amount))
    for (const t of postTB) tbPost.set(keys[t.accountIndex], Number(t.uiTokenAmount.amount))

    return {
      crimeSOLPre:    crimeSOLIdx >= 0 ? pre[crimeSOLIdx]  : null,
      crimeSOLPost:   crimeSOLIdx >= 0 ? post[crimeSOLIdx] : null,
      crimeTokenPre:  tbPre.get(POOLS.CRIME_SOL.tokenVault) ?? null,
      crimeTokenPost: tbPost.get(POOLS.CRIME_SOL.tokenVault) ?? null,
      fraudSOLPre:    fraudSOLIdx >= 0 ? pre[fraudSOLIdx]  : null,
      fraudSOLPost:   fraudSOLIdx >= 0 ? post[fraudSOLIdx] : null,
      fraudTokenPre:  tbPre.get(POOLS.FRAUD_SOL.tokenVault) ?? null,
      fraudTokenPost: tbPost.get(POOLS.FRAUD_SOL.tokenVault) ?? null,
    }
  } catch (e) {
    // Re-throw rate limit errors so the caller can retry
    if (e instanceof Error && 'isRateLimit' in e) throw e
    return null
  }
}

/** fetchTxBalances with exponential back-off on 429 */
async function fetchTxSafe(sig: string): ReturnType<typeof fetchTxBalances> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchTxBalances(sig)
    } catch (e) {
      if (e instanceof Error && 'isRateLimit' in e && attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      return null
    }
  }
  return null
}

// ─── localStorage cache ───────────────────────────────────────────────────────

const CACHE_KEY = 'profit_history_v1'

interface CacheData {
  points: PricePoint[]
  vault: { cSol: number; cTok: number; fSol: number; fTok: number }
  lastTime: number   // blockTime of last processed sig
  savedAt: number    // Date.now() when cache was written
}

function loadCache(): CacheData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CacheData) : null
  } catch { return null }
}

function saveCache(data: CacheData) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* quota exceeded */ }
}

// ─── Main historical loader ───────────────────────────────────────────────────

/**
 * Reconstruct historical price points via FORWARD REPLAY using post-balances.
 * Uses localStorage to cache results — first load ~60s, subsequent loads instant.
 *
 * Strategy:
 *   1. Load cache from localStorage.
 *   2. If cache < 5 min old, return immediately.
 *   3. Otherwise fetch only NEW signatures (after cache's lastTime).
 *   4. Process new txs in ascending order, update running vault state.
 *   5. Merge with cached points and save back to localStorage.
 */
export async function fetchHistoricalPricePoints(
  crimeSupply: number,
  fraudSupply: number,
  solUsdPrice: number,
  onProgress?: (done: number, total: number) => void,
): Promise<PricePoint[]> {

  // ── Load cache ──────────────────────────────────────────────────────────────
  const cache = loadCache()
  let cachedPoints: PricePoint[]   = cache?.points ?? []
  let cSol  = cache?.vault.cSol    ?? 0
  let cTok  = cache?.vault.cTok    ?? 0
  let fSol  = cache?.vault.fSol    ?? 0
  let fTok  = cache?.vault.fTok    ?? 0
  let lastTime = cache?.lastTime   ?? 0

  // Return immediately if cache is fresh (< 5 min)
  if (cache && Date.now() - cache.savedAt < 5 * 60_000 && cachedPoints.length > 0) {
    console.log('[history] cache fresh →', cachedPoints.length, 'points')
    onProgress?.(1, 1)
    return cachedPoints
  }

  // ── Fetch only new signatures since lastTime ────────────────────────────────
  console.log('[history] fetching sigs since', lastTime ? new Date(lastTime * 1000).toISOString() : 'launch')
  const [crimeSigs, fraudSigs] = await Promise.all([
    fetchAllSignatures(POOLS.CRIME_SOL.solVault),
    fetchAllSignatures(POOLS.FRAUD_SOL.solVault),
  ])

  const sigMap = new Map<string, number>()
  for (const s of [...crimeSigs, ...fraudSigs]) sigMap.set(s.sig, s.blockTime)

  // Only new sigs (strictly after lastTime), sorted ascending (oldest first)
  const newSigs = Array.from(sigMap.entries())
    .filter(([, bt]) => bt > lastTime)
    .sort((a, b) => a[1] - b[1])

  console.log('[history] cache:', cachedPoints.length, 'pts | new sigs:', newSigs.length)

  if (newSigs.length === 0) {
    // Nothing new — touch cache timestamp and return
    if (cachedPoints.length > 0) {
      saveCache({ points: cachedPoints, vault: { cSol, cTok, fSol, fTok }, lastTime, savedAt: Date.now() })
      onProgress?.(1, 1)
      return cachedPoints
    }
  }

  // ── Forward replay of new transactions ─────────────────────────────────────
  const total = newSigs.length
  const newPoints: PricePoint[] = []

  const BATCH = 10
  for (let i = 0; i < newSigs.length; i += BATCH) {
    const batch = newSigs.slice(i, i + BATCH)
    const txData = await Promise.all(batch.map(([sig]) => fetchTxSafe(sig)))

    for (let j = 0; j < batch.length; j++) {
      const [, blockTime] = batch[j]
      const tb = txData[j]

      if (tb) {
        if (tb.crimeSOLPost  !== null) cSol = tb.crimeSOLPost
        if (tb.crimeTokenPost !== null) cTok = tb.crimeTokenPost
        if (tb.fraudSOLPost  !== null) fSol = tb.fraudSOLPost
        if (tb.fraudTokenPost !== null) fTok = tb.fraudTokenPost
      }

      if (cSol > 0 && cTok > 0 && fSol > 0 && fTok > 0) {
        const state: VaultState = { crimeSolLamports: cSol, crimeTokenRaw: cTok, fraudSolLamports: fSol, fraudTokenRaw: fTok }
        const mcUsd = computeMcFromState(state, crimeSupply, fraudSupply, solUsdPrice)
        if (mcUsd > 0) newPoints.push({ time: blockTime, mcSol: mcUsd / solUsdPrice, mcUsd })
      }
    }

    onProgress?.(Math.min(i + BATCH, total), total)
    if (i + BATCH < newSigs.length) await new Promise(r => setTimeout(r, 200))
  }

  // ── Merge and save ──────────────────────────────────────────────────────────
  const allPoints = [...cachedPoints, ...newPoints]  // already ascending

  if (allPoints.length > 0) {
    const newLastTime = newSigs.length > 0 ? newSigs[newSigs.length - 1][1] : lastTime
    saveCache({
      points: allPoints,
      vault: { cSol, cTok, fSol, fTok },
      lastTime: newLastTime,
      savedAt: Date.now(),
    })
    console.log('[history] saved', allPoints.length, 'total points to cache')
  }

  return allPoints
}
