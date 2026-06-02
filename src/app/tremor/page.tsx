import type { Metadata } from 'next'
import { TremorClient } from './TremorClient'

export const metadata: Metadata = {
  title: 'Civic Tremor · Lobby Market',
  description:
    'The opinion seismograph — detect where recent voters are breaking from historical consensus, revealing emerging reversals, surges, and opinion shifts in real time.',
  openGraph: {
    title: 'Civic Tremor · Lobby Market',
    description:
      'Where is opinion moving? Civic Tremor compares the last 24h of votes against each topic\'s all-time consensus — surfacing surges, reversals, deepening majorities, and eroding leads before they fully register.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Tremor · Lobby Market',
    description:
      'The opinion seismograph. Where are recent voters breaking from historical consensus — surges, reversals, deepening, erosion.',
  },
}

export default function TremorPage() {
  return <TremorClient />
}
