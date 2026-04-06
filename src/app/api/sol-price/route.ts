import { NextResponse } from 'next/server'

export const revalidate = 0

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 0 },
      }
    )

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

    const data = await res.json()
    const price = data?.solana?.usd

    if (!price || typeof price !== 'number') throw new Error('Invalid response')

    return NextResponse.json({ price }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    console.error('[sol-price]', err)
    // Fallback: try alternate CoinGecko endpoint
    try {
      const res2 = await fetch(
        'https://api.coingecko.com/api/v3/coins/solana?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false',
        { headers: { 'Accept': 'application/json' } }
      )
      const data2 = await res2.json()
      const price = data2?.market_data?.current_price?.usd
      if (price) return NextResponse.json({ price })
    } catch {}

    return NextResponse.json({ price: null, error: 'fetch_failed' }, { status: 503 })
  }
}
