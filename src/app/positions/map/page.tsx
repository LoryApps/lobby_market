import type { Metadata } from 'next'
import { MapClient } from './MapClient'

export const metadata: Metadata = {
  title: 'My Civic Map · Lobby Market',
  description:
    'An interactive graph of every topic you have voted on — clustered by category, coloured by your position.',
  robots: { index: false },
}

export default function PositionsMapPage() {
  return <MapClient />
}
