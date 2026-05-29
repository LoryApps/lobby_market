import type { Metadata } from 'next'
import { RhetoricClient } from './RhetoricClient'

export const metadata: Metadata = {
  title: 'Civic Rhetoric · Lobby Market',
  description:
    'Discover your rhetorical DNA — whether you argue with evidence, logic, history, hypotheticals, values, or personal conviction. Your Lobby Market debating style, decoded.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Rhetoric · Lobby Market',
    description:
      'What kind of debater are you? Evidence-based, logical, historical, or normative? Find your rhetorical archetype and coaching tips.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Rhetoric · Lobby Market',
    description: 'Your rhetorical style, archetype, and argument coaching — all in one place.',
  },
}

export default function RhetoricPage() {
  return <RhetoricClient />
}
