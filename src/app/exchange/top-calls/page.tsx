import type { Metadata } from 'next'
import { TopCallsClient } from './TopCallsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Top Calls · Lobby Exchange',
  description:
    'The most accurate civic market predictions — ranked after resolution. See who called the consensus correctly, with what confidence, and how close their target was to the final settlement price.',
  robots: { index: false },
  openGraph: {
    title: 'Top Calls · Lobby Exchange',
    description:
      'A hall of fame for the sharpest civic market predictions. Ranked by accuracy, confidence, and composite score after market resolution.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Top Calls · Lobby Exchange',
    description:
      'Who called the civic markets correctly? Ranked community predictions after resolution — accuracy, confidence, and composite score.',
  },
}

export default function TopCallsPage() {
  return <TopCallsClient />
}
