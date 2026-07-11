import type { Metadata } from 'next'
import { PositionPapersClient } from './PositionPapersClient'

export const metadata: Metadata = {
  title: 'Civic Position Papers · Lobby Market',
  description:
    'The most compelling civic arguments on Lobby Market — relay chains that the community voted as definitive. Browse the collective case FOR and AGAINST every major policy debate.',
  openGraph: {
    title: 'Civic Position Papers · Lobby Market',
    description:
      'Community-validated civic arguments. Relay chains voted compelling by the Lobby — the platform\'s definitive collective position papers on the issues that matter.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Position Papers · Lobby Market',
    description:
      'The community\'s most compelling collective arguments — relay chains voted as definitive civic position papers.',
  },
}

export default function PositionPapersPage() {
  return <PositionPapersClient />
}
