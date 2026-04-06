'use client'
import { useEffect, useRef, useCallback } from 'react'
import type { OHLCVCandle } from '@/lib/helius'
import type { IntervalKey } from '@/hooks/useMarketData'

interface ChartProps {
  candles: OHLCVCandle[]
  interval: IntervalKey
  onIntervalChange: (i: IntervalKey) => void
}

const INTERVALS: IntervalKey[] = ['1m', '5m', '30m', '1d']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChart = any

export default function Chart({ candles, interval, onIntervalChange }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<AnyChart>(null)
  const candleSeriesRef = useRef<AnyChart>(null)
  const prevCountRef = useRef(0)
  const userScrolledRef = useRef(false)

  const initChart = useCallback(async () => {
    if (!containerRef.current) return
    const { createChart } = await import('lightweight-charts')
    const el = containerRef.current
    const { width, height } = el.getBoundingClientRect()

    const chart = createChart(el, {
      width: width || 900,
      height: height || 500,
      layout: {
        background: { color: '#1c120a' },
        textColor: '#9a7a5a',
      },
      grid: {
        vertLines: { color: '#2c1e12' },
        horzLines: { color: '#2c1e12' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#4a3520', labelBackgroundColor: '#2c1e12' },
        horzLine: { color: '#4a3520', labelBackgroundColor: '#2c1e12' },
      },
      rightPriceScale: {
        borderColor: '#4a3520',
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.05 },
      },
      timeScale: {
        borderColor: '#4a3520',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 18,
        rightOffset: 8,
        minBarSpacing: 4,
      },
      handleScroll: true,
      handleScale: true,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor:         '#00c758',
      downColor:       '#c04030',
      borderUpColor:   '#00c758',
      borderDownColor: '#c04030',
      wickUpColor:     '#007a35',
      wickDownColor:   '#7a2820',
      borderVisible:   true,
      priceFormat: {
        type: 'custom',
        minMove: 0.01,
        formatter: (p: number) => {
          if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(2)}M`
          if (p >= 1_000)     return `$${(p / 1_000).toFixed(1)}K`
          return `$${p.toFixed(0)}`
        },
      },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      userScrolledRef.current = true
    })

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      chart.resize(width, height)
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    initChart().then(fn => { cleanup = fn })
    return () => { cleanup?.() }
  }, [initChart])

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return

    const data = candles.map(c => ({
      time: c.time as number,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    try {
      candleSeriesRef.current.setData(data)

      const isFirstLoad = prevCountRef.current === 0
      prevCountRef.current = candles.length

      if (isFirstLoad) {
        chartRef.current?.timeScale().fitContent()
        userScrolledRef.current = false
      } else if (!userScrolledRef.current) {
        chartRef.current?.timeScale().scrollToRealTime()
      }
    } catch { /* chart removed */ }
  }, [candles])

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 pt-2 pb-2 border-b border-fw-border">
        {INTERVALS.map(i => (
          <button
            key={i}
            onClick={() => {
              prevCountRef.current = 0
              userScrolledRef.current = false
              onIntervalChange(i)
            }}
            className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
              i === interval
                ? 'bg-fw-gold border-fw-gold text-fw-bg font-bold shadow-gold-sm'
                : 'border-fw-border text-fw-muted hover:text-fw-text hover:border-fw-gold/50'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  )
}
