import type { Metadata } from 'next'
import { DebateSeriesListClient } from './DebateSeriesListClient'

export const metadata: Metadata = {
  title: 'Debate Series · Lobby Market',
  description:
    'Multi-round debate competitions — watch rivals clash across best-of-3 and best-of-5 series to settle the most contested civic questions.',
  openGraph: {
    title: 'Debate Series · Lobby Market',
    description: 'Best-of-3 and best-of-5 debate competitions. Who will take the series?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Debate Series · Lobby Market',
    description: 'Multi-round debate competitions on the most contested civic questions.',
  },
}

export default function DebateSeriesPage() {
  return <DebateSeriesListClient />
}
