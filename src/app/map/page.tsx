import type { Metadata } from 'next'
import { MapClient } from './MapClient'

export const metadata: Metadata = {
  title: 'The Civic Policy Map · Lobby Market',
  description:
    'An interactive scatter plot of every civic topic — plotted by consensus strength (FOR vs AGAINST) against engagement. Spot fault lines, mandates, and emerging debates at a glance.',
  openGraph: {
    title: 'The Civic Policy Map · Lobby Market',
    description:
      'See every civic debate mapped by consensus and engagement. Blue = strong FOR mandate. Red = strong rejection. Purple = contested territory.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Policy Map · Lobby Market',
    description:
      'Interactive map of every civic debate — consensus vs. engagement, live.',
  },
}

export default function MapPage() {
  return <MapClient />
}
