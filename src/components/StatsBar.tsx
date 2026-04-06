'use client'

interface StatsBarProps {
  mcUsd: number
  mcSol: number
  crimeMcUsd: number
  fraudMcUsd: number
  crimePriceUsd: number
  fraudPriceUsd: number
  solUsdPrice: number
  change24h: number | null
  stakedAmount: number
  stakedPct: number
  wsConnected: boolean
  lastUpdate: number
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(3)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function fmtPrice(n: number): string {
  if (n === 0) return '—'
  if (n < 0.00001) return `$${n.toExponential(3)}`
  if (n < 0.001) return `$${n.toFixed(7)}`
  return `$${n.toFixed(5)}`
}

function fmtTime(ms: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false })
}

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'gold' | 'green' | 'red' | 'muted'
  large?: boolean
}

function StatCard({ label, value, sub, accent = 'gold', large }: StatCardProps) {
  const colorMap = {
    gold:  'text-fw-gold glow-gold',
    green: 'text-fw-green glow-green',
    red:   'text-fw-red',
    muted: 'text-fw-muted',
  }
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 border border-fw-border bg-fw-surface/60 rounded">
      <span className="text-fw-muted font-mono text-[10px] uppercase tracking-widest">{label}</span>
      <span className={`font-mono font-bold leading-none ${large ? 'text-xl' : 'text-sm'} ${colorMap[accent]}`}>
        {value}
      </span>
      {sub && <span className="text-fw-muted font-mono text-[10px]">{sub}</span>}
    </div>
  )
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export default function StatsBar({
  mcUsd, mcSol, crimeMcUsd, fraudMcUsd, crimePriceUsd, fraudPriceUsd,
  solUsdPrice, change24h, stakedAmount, stakedPct, wsConnected, lastUpdate
}: StatsBarProps) {
  const changePos = change24h !== null && change24h >= 0

  return (
    <div className="flex flex-wrap justify-center gap-2 px-6 py-3 border-b border-fw-border">

      {/* PROFIT total */}
      <StatCard
        label="$PROFIT Market Cap"
        value={fmtUsd(mcUsd)}
        sub={`${mcSol.toFixed(1)} SOL`}
        accent="gold"
        large
      />

      {/* Divider */}
      <div className="hidden sm:block w-px bg-fw-border self-stretch mx-1" />

      {/* CRIME */}
      <StatCard
        label="$CRIME Market Cap"
        value={fmtUsd(crimeMcUsd)}
        sub={`price ${fmtPrice(crimePriceUsd)}`}
        accent="green"
      />

      {/* FRAUD */}
      <StatCard
        label="$FRAUD Market Cap"
        value={fmtUsd(fraudMcUsd)}
        sub={`price ${fmtPrice(fraudPriceUsd)}`}
        accent="green"
      />

      {/* Divider */}
      <div className="hidden sm:block w-px bg-fw-border self-stretch mx-1" />

      {/* PROFIT staking */}
      <div className="flex flex-col gap-0.5 px-4 py-3 border border-fw-border bg-fw-surface/60 rounded">
        <span className="text-fw-muted font-mono text-[10px] uppercase tracking-widest">$PROFIT Staked</span>
        <span className="font-mono font-bold text-sm leading-none text-fw-gold glow-gold">
          {stakedAmount > 0 ? `${fmtM(stakedAmount)} PROFIT` : '—'}
        </span>
        {stakedAmount > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-20 h-1 bg-fw-border rounded-full overflow-hidden">
              <div
                className="h-full bg-fw-gold rounded-full"
                style={{ width: `${Math.min(stakedPct, 100)}%` }}
              />
            </div>
            <span className="text-fw-muted font-mono text-[10px]">{stakedPct.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-fw-border self-stretch mx-1" />

      {/* 24h change */}
      {change24h !== null && (
        <StatCard
          label="24H Change"
          value={`${changePos ? '+' : ''}${change24h.toFixed(2)}%`}
          accent={changePos ? 'green' : 'red'}
        />
      )}

      {/* SOL price */}
      <StatCard
        label="SOL / USD"
        value={`$${solUsdPrice.toFixed(2)}`}
        accent="muted"
      />

      {/* Live indicator */}
      <div className="flex flex-col gap-0.5 px-4 py-3 border border-fw-border bg-fw-surface/60 rounded justify-center">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wsConnected ? 'bg-fw-green animate-pulse' : 'bg-fw-red'}`} />
          <span className={`font-mono font-bold text-[11px] ${wsConnected ? 'text-fw-green' : 'text-fw-red'}`}>
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <span className="text-fw-muted font-mono text-[10px]">{fmtTime(lastUpdate)}</span>
      </div>

    </div>
  )
}
