import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CompareClient } from './CompareClient'

export const metadata: Metadata = {
  title: 'Compare Markets · Lobby Exchange',
  description:
    'Side-by-side comparison of any two civic prediction markets — consensus price, volume, price history, and top arguments.',
  openGraph: {
    title: 'Compare Markets · Lobby Exchange',
    description:
      'Pick any two civic topics and compare their consensus price, momentum, volume, and best arguments head-to-head.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Compare Markets · Lobby Exchange',
    description: 'Head-to-head civic market comparison — consensus, volume, arguments.',
  },
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareClient />
    </Suspense>
  )
}
