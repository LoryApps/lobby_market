import type { Metadata } from 'next'
import { MostReactedClient } from './MostReactedClient'

export const metadata: Metadata = {
  title: 'Community Reactions · Lobby Market',
  description:
    'Discover which civic debates the community found most insightful, controversial, complex, or surprising. Explore topics beyond just vote counts — see what resonated emotionally.',
  openGraph: {
    title: 'Community Reactions · Lobby Market',
    description:
      'Topics the civic community called out as insightful, controversial, complex, or surprising. A different lens on what matters.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Community Reactions · Lobby Market',
    description:
      'See which debates sparked the most emotional responses from the civic community.',
  },
}

export default function MostReactedPage() {
  return <MostReactedClient />
}
