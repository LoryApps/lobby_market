import type { Metadata } from 'next'
import { FootprintClient } from './FootprintClient'

export const metadata: Metadata = {
  title: 'Civic Footprint · Lobby Market',
  description:
    'See the permanent mark you\'ve left on the Lobby — laws you helped shape, arguments that reached the most citizens, and your overall civic impact score.',
  openGraph: {
    title: 'Civic Footprint · Lobby Market',
    description:
      'Laws shaped, arguments that resonated, and the enduring civic legacy you\'ve built on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Footprint · Lobby Market',
    description: 'How many laws have your votes helped create? See your lasting civic impact.',
  },
  robots: { index: false },
}

export default function FootprintPage() {
  return <FootprintClient />
}
