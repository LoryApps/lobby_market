import type { Metadata } from 'next'
import { WellspringClient } from './WellspringClient'

export const metadata: Metadata = {
  title: 'The Civic Wellspring · Lobby Market',
  description:
    'Which debates opened the floodgates? The Civic Wellspring ranks topics by how many follow-on chain debates they spawned — revealing the most generative ideas in the Lobby.',
  openGraph: {
    title: 'The Civic Wellspring · Lobby Market',
    description:
      'Some debates end when they resolve. Others open a door — spawning chains of follow-on questions that reshape the whole conversation. The Wellspring finds the most generative topics on the platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Wellspring · Lobby Market',
    description:
      'Which civic debates were the most generative? Topics that spawned the most chain questions — ranked by intellectual fertility.',
  },
}

export default function WellspringPage() {
  return <WellspringClient />
}
