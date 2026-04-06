import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '$PROFIT Chart | fraudsworth.fun',
  description: 'Live $PROFIT marketcap chart — powered by $CRIME + $FRAUD',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
