import type { Metadata } from 'next'
import { TournamentsClient } from './TournamentsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Prediction Tournaments · Lobby Exchange',
  description:
    'Compete to make the most accurate civic market predictions. Join active tournaments, climb the leaderboard, and earn badges and Clout.',
  robots: { index: false },
  openGraph: {
    title: 'Prediction Tournaments · Lobby Exchange',
    description:
      'Head-to-head prediction competitions on civic consensus markets. The most accurate forecaster wins.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Prediction Tournaments · Lobby Exchange',
    description: 'Compete to predict civic market outcomes. Join a tournament, climb the leaderboard.',
  },
}

export default function TournamentsPage() {
  return <TournamentsClient />
}
