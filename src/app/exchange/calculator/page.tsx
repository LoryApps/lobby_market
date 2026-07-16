import type { Metadata } from 'next'
import { CalculatorClient } from './CalculatorClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Calculator · Lobby Exchange',
  description: 'Analyse any civic prediction market — resolution probability, vote leverage, and historical analogues for any live debate.',
  robots: { index: false },
  openGraph: {
    title: 'Market Calculator · Lobby Exchange',
    description: 'Resolution probability, vote leverage, and similar resolved markets for any civic debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function CalculatorPage() {
  return <CalculatorClient />
}
