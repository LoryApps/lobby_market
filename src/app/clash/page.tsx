import type { Metadata } from 'next'
import { ClashClient } from './ClashClient'

export const metadata: Metadata = {
  title: 'The Clash · Lobby Market',
  description:
    'Live head-to-head argument battles across every trending civic topic. The best FOR and AGAINST arguments face off — upvote the one that makes the stronger case.',
  openGraph: {
    title: 'The Clash · Lobby Market',
    description:
      'Watch the best arguments battle it out in real time. FOR vs AGAINST — choose your side.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Clash · Lobby Market',
    description:
      'Live argument battles on every trending topic. Read both sides, upvote the stronger argument.',
  },
}

export default function ClashPage() {
  return <ClashClient />
}
