import type { Metadata } from 'next'
import { CheckinClient } from './CheckinClient'

export const metadata: Metadata = {
  title: 'Daily Check-In · Lobby Market',
  description:
    'Your daily civic moment — one question, one vote, one streak. Show up every day and build your civic record.',
  openGraph: {
    title: 'Daily Civic Check-In · Lobby Market',
    description:
      'One focused civic question per day. Vote, see the community split, and keep your streak alive.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Daily Check-In · Lobby Market',
    description: 'Your daily civic moment. One question. Your vote. Keep the streak alive.',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function CheckinPage() {
  return <CheckinClient />
}
