'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import StatsBar from '@/components/StatsBar'
import { useMarketData, type IntervalKey } from '@/hooks/useMarketData'

const Chart = dynamic(() => import('@/components/Chart'), { ssr: false })

export default function Home() {
  const [interval, setInterval] = useState<IntervalKey>('1m')
  const state = useMarketData(interval)

  return (
    <div className="min-h-screen bg-fw-bg flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-fw-border bg-fw-deep/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">

          {/* Logo + title */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-heading text-fw-gold text-lg leading-none tracking-wide glow-gold">
                Dr. Fraudsworth
              </h1>
              <p className="font-mono text-fw-muted text-[10px] tracking-widest uppercase mt-0.5">
                $PROFIT · Live Market Chart
              </p>
            </div>
          </div>

          {/* Right: history loading + link */}
          <div className="flex items-center gap-4">
            {state.historyLoading && (
              <div className="flex items-center gap-2 font-mono text-xs text-fw-muted">
                <div className="w-3 h-3 border border-fw-gold border-t-transparent rounded-full animate-spin" />
                <span>Loading history {state.historyProgress}%</span>
                <div className="w-20 h-1 bg-fw-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-fw-gold transition-all duration-300"
                    style={{ width: `${state.historyProgress}%` }}
                  />
                </div>
              </div>
            )}
            <a
              href="https://fraudsworth.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-fw-muted hover:text-fw-gold transition-colors border border-fw-border hover:border-fw-gold/50 px-3 py-1 rounded"
            >
              fraudsworth.fun ↗
            </a>
            <a
              href="https://fraudsworth.fyi"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-fw-muted hover:text-fw-gold transition-colors border border-fw-border hover:border-fw-gold/50 px-3 py-1 rounded"
            >
              fraudsworth.fyi ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto w-full px-6 pt-4 pb-2">
        <StatsBar
          mcUsd={state.mcUsd}
          mcSol={state.mcSol}
          crimeMcUsd={state.crimeMcUsd}
          fraudMcUsd={state.fraudMcUsd}
          crimePriceUsd={state.crimePriceUsd}
          fraudPriceUsd={state.fraudPriceUsd}
          solUsdPrice={state.solUsdPrice}
          change24h={state.change24h}
          stakedAmount={state.staking.stakedAmount}
          stakedPct={state.staking.stakedPct}
          wsConnected={state.wsConnected}
          lastUpdate={state.lastUpdate}
        />
      </div>

      {/* ── Chart ─────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-6 pb-4 flex flex-col min-h-0">
        <div className="flex-1 border border-fw-border rounded-lg overflow-hidden bg-fw-surface/30 flex flex-col min-h-0">
          {state.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-fw-gold border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-fw-muted text-sm">Connecting to Solana...</span>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 flex flex-col min-h-0">
              <Chart
                candles={state.candles}
                interval={interval}
                onIntervalChange={setInterval}
              />

              {/* History loading overlay — only when no candles yet */}
              {state.historyLoading && state.candles.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-fw-bg/70 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 border border-fw-border bg-fw-surface rounded-lg px-8 py-6">
                    <div className="w-8 h-8 border-2 border-fw-gold border-t-transparent rounded-full animate-spin" />
                    <span className="font-mono text-fw-text text-sm">
                      Loading history... {state.historyProgress}%
                    </span>
                    <div className="w-48 h-1.5 bg-fw-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-fw-gold transition-all duration-300 rounded-full"
                        style={{ width: `${state.historyProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-fw-border bg-fw-deep/60">
        <div className="max-w-screen-2xl mx-auto px-6 py-2 flex items-center justify-between">
          <span className="font-mono text-fw-muted text-[10px]">
            Data: Helius RPC · Solana mainnet · AMM <span className="text-fw-border">5JsSAL3kJD...</span>
          </span>
          <span className="font-mono text-fw-muted text-[10px]">
            MC = $CRIME + $FRAUD · prices update every 10s
          </span>
        </div>
      </footer>

    </div>
  )
}
