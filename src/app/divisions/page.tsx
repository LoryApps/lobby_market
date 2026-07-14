import type { Metadata } from 'next'
import { DivisionsClient } from './DivisionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'The Division Bell · Lobby Market',
  description:
    'Formal parliamentary divisions — when the bell rings, citizens walk through the Aye or No lobby. The permanent record of every binding vote on the platform.',
  openGraph: {
    title: 'The Division Bell · Lobby Market',
    description:
      'The Division Bell has rung. Walk through the Aye or No lobby to cast your formal parliamentary vote. Every division is permanently recorded.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Division Bell · Lobby Market',
    description:
      'Formal recorded votes — the heart of Lobby Market. When the bell rings, you choose your lobby.',
  },
}

export default function DivisionsPage() {
  return <DivisionsClient />
}
