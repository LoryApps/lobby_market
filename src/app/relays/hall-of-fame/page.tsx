import type { Metadata } from 'next'
import { HallOfFameClient } from './HallOfFameClient'

export const metadata: Metadata = {
  title: 'Relay Hall of Fame · Lobby Market',
  description:
    'The all-time greatest civic relay chains — most compelling, longest, fastest, and the category champions. Celebrating the best collaborative arguments ever built on the Lobby.',
  openGraph: {
    title: 'Relay Hall of Fame · Lobby Market',
    description:
      'The best relay chains ever built on Lobby Market — most compelling, longest argument chains, and category champions.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relay Hall of Fame · Lobby Market',
    description:
      'The all-time greatest civic relay chains. Most compelling, longest, fastest — the champions of collaborative civic argument.',
  },
}

export default function RelayHallOfFamePage() {
  return <HallOfFameClient />
}
