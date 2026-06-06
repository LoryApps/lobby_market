import type { Metadata } from 'next'
import { TractionClient } from './TractionClient'

export const metadata: Metadata = {
  title: 'Civic Traction · Lobby Market',
  description:
    'Which debates are building momentum right now? Traction tracks the composite acceleration of votes, arguments, and new watchers — surfacing the topics that are about to break out.',
  openGraph: {
    title: 'Civic Traction · Lobby Market',
    description:
      'Live composite momentum signal: vote velocity + argument burst + new subscriptions, combined into a single traction score per debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Traction · Lobby Market',
    description: 'Track the acceleration of civic debates — votes, arguments, and new watchers combined into a live traction index.',
  },
}

export default function TractionPage() {
  return <TractionClient />
}
