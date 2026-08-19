import type { Metadata } from 'next'
import { ThesisAnalyticsClient } from './ThesisAnalyticsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Thesis Analytics · Lobby Market',
  description:
    'Who predicts the future of civic debate most accurately? Platform-wide thesis prediction stats — top forecasters, category accuracy, resolution timelines, and contrarian calls.',
  openGraph: {
    title: 'Thesis Analytics · Lobby Market',
    description:
      'Deep stats on the Civic Oracle: who has the sharpest foresight, which categories produce the most accurate predictions, and how long civic claims take to resolve.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Analytics · Lobby Market',
    description: 'Prediction accuracy leaderboard, category breakdowns, and resolution stats for the Civic Oracle.',
  },
}

export default function ThesisAnalyticsPage() {
  return <ThesisAnalyticsClient />
}
