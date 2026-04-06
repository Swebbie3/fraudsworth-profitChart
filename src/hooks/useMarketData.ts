'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchMarketData, calcMarketcap, fetchHistoricalPricePoints, buildCandles, fetchStakingData, type OHLCVCandle, type PricePoint, type StakingData } from '@/lib/helius'
// PricePoint used internally only
import { connectWebSocket } from '@/lib/websocket'

export type IntervalKey = '1m' | '5m' | '30m' | '1d'

export const INTERVAL_SECONDS: Record<IntervalKey, number> = {
  '1m':  60,
  '5m':  300,
  '30m': 1800,
  '1d':  86400,
}

export interface MarketState {
  mcUsd: number
  mcSol: number
  crimeMcUsd: number
  fraudMcUsd: number
  crimePriceSol: number
  fraudPriceSol: number
  crimePriceUsd: number
  fraudPriceUsd: number
  solUsdPrice: number
  change24h: number | null
  staking: StakingData
  candles: OHLCVCandle[]
  loading: boolean
  historyLoading: boolean
  historyProgress: number
  wsConnected: boolean
  lastUpdate: number
}

export function useMarketData(interval: IntervalKey) {
  const [state, setState] = useState<MarketState>({
    mcUsd: 0, mcSol: 0,
    crimeMcUsd: 0, fraudMcUsd: 0,
    crimePriceSol: 0, fraudPriceSol: 0,
    crimePriceUsd: 0, fraudPriceUsd: 0,
    solUsdPrice: 0,
    change24h: null,
    staking: { stakedAmount: 0, stakedPct: 0, stakerCount: 0 },
    candles: [],
    loading: true,
    historyLoading: false,
    historyProgress: 0,
    wsConnected: false,
    lastUpdate: 0,
  })

  // Holds ALL price points: historical + live
  const historyRef = useRef<PricePoint[]>([])
  const liveRef = useRef<PricePoint[]>([])
  const supplyRef = useRef({ crimeSupply: 996_267_079, fraudSupply: 993_910_723, solUsdPrice: 88 })
  const intervalRef = useRef(interval)
  intervalRef.current = interval

  function mergeAndBuild(hist: PricePoint[], live: PricePoint[], ivl: IntervalKey) {
    const map = new Map<number, PricePoint>()
    for (const p of hist) map.set(p.time, p)
    for (const p of live) map.set(p.time, p)
    const all = Array.from(map.values()).sort((a, b) => a.time - b.time)
    return buildCandles(all, INTERVAL_SECONDS[ivl])
  }

  // Live price polling
  const refreshPrice = useCallback(async () => {
    try {
      const data = await fetchMarketData()
      supplyRef.current = { crimeSupply: data.crimeSupply, fraudSupply: data.fraudSupply, solUsdPrice: data.solUsdPrice }
      const mc = calcMarketcap(data)

      const now = Math.floor(Date.now() / 1000)
      const newPoint: PricePoint = { time: now, mcSol: mc.mcSol, mcUsd: mc.mcUsd }

      liveRef.current = [...liveRef.current.slice(-9999), newPoint]

      const candles = mergeAndBuild(historyRef.current, liveRef.current, intervalRef.current)

      // 24h change from oldest point we have
      const allPoints = [...historyRef.current, ...liveRef.current].sort((a, b) => a.time - b.time)
      const ago24h = now - 86400
      const oldest = allPoints.find(p => p.time >= ago24h)
      const change24h = oldest && oldest.mcUsd > 0 ? ((mc.mcUsd - oldest.mcUsd) / oldest.mcUsd) * 100 : null

      setState(prev => ({
        ...prev,
        mcUsd: mc.mcUsd, mcSol: mc.mcSol,
        crimeMcUsd: mc.crimeMcUsd, fraudMcUsd: mc.fraudMcUsd,
        crimePriceSol: mc.crimePriceSol, fraudPriceSol: mc.fraudPriceSol,
        crimePriceUsd: mc.crimePriceUsd, fraudPriceUsd: mc.fraudPriceUsd,
        solUsdPrice: data.solUsdPrice,
        change24h,
        candles,
        loading: false,
        lastUpdate: Date.now(),
      }))
    } catch (err) {
      console.error('[useMarketData] refresh error:', err)
    }
  }, [])

  // Rebuild when interval changes
  useEffect(() => {
    const candles = mergeAndBuild(historyRef.current, liveRef.current, interval)
    if (candles.length > 0) setState(prev => ({ ...prev, candles }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval])

  // Load historical data once
  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setState(prev => ({ ...prev, historyLoading: true, historyProgress: 0 }))
      try {
        const { crimeSupply, fraudSupply, solUsdPrice } = supplyRef.current
        console.log('[history] starting load, supply:', crimeSupply, fraudSupply, 'solUsd:', solUsdPrice)
        const points = await fetchHistoricalPricePoints(
          crimeSupply, fraudSupply, solUsdPrice,
          (done, total) => {
            if (!cancelled) {
              setState(prev => ({ ...prev, historyProgress: Math.round((done / total) * 100) }))
            }
          },
        )
        if (cancelled) return

        console.log('[history] loaded', points.length, 'price points')
        historyRef.current = points
        const candles = mergeAndBuild(points, liveRef.current, intervalRef.current)
        console.log('[history] built', candles.length, 'candles for interval', intervalRef.current)
        setState(prev => ({ ...prev, candles, historyLoading: false, historyProgress: 100 }))
      } catch (err) {
        console.error('[useMarketData] history error:', err)
        if (!cancelled) setState(prev => ({ ...prev, historyLoading: false }))
      }
    }

    // Wait for first live price fetch to seed supplyRef before loading history
    const t = setTimeout(loadHistory, 2000)
    return () => { cancelled = true; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // WebSocket + polling
  useEffect(() => {
    refreshPrice()
    const disconnect = connectWebSocket(refreshPrice)
    setState(prev => ({ ...prev, wsConnected: true }))
    const poll = setInterval(refreshPrice, 10_000)

    // Staking data — fetch immediately then every 30s
    async function refreshStaking() {
      try {
        const staking = await fetchStakingData()
        setState(prev => ({ ...prev, staking }))
      } catch { /* silent */ }
    }
    refreshStaking()
    const stakingPoll = setInterval(refreshStaking, 30_000)

    return () => {
      disconnect()
      clearInterval(poll)
      clearInterval(stakingPoll)
      setState(prev => ({ ...prev, wsConnected: false }))
    }
  }, [refreshPrice])

  return state
}
