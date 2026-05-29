import type { Metadata } from 'next'
import { ConvictionClient } from './ConvictionClient'

export const metadata: Metadata = {
  title: 'Civic Conviction · Lobby Market',
  description:
    'See how ideologically consistent you are across every debate category. Discover your strongholds — and where you\'re genuinely undecided.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Conviction · Lobby Market',
    description: 'Where have you made up your mind? Your personal conviction score by debate category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Conviction · Lobby Market',
    description: 'Discover where you\'re a true believer — and where you vote on the merits.',
  },
}

export default function ConvictionPage() {
  return <ConvictionClient />
}
