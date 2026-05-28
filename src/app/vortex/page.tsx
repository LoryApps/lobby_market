import type { Metadata } from 'next'
import { VortexClient } from './VortexClient'

export const metadata: Metadata = {
  title: 'The Civic Vortex · Lobby Market',
  description:
    'Argument black holes — civic topics where intellectual debate rages far beyond their vote count. Ranked by argument intensity per voter: unique voices, reply depth, and rhetorical fire.',
  openGraph: {
    title: 'The Civic Vortex · Lobby Market',
    description:
      'Where is the civic argument the most fierce? The Vortex surfaces topics whose debate intensity vastly outpaces their voter base — the intellectual fires of democratic discourse.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Vortex · Lobby Market',
    description:
      'Topics where argument burns hottest per voter. Civic debate black holes — ranked by intellectual intensity.',
  },
}

export default function VortexPage() {
  return <VortexClient />
}
