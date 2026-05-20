import type { Metadata } from 'next'
import { InsightsClient } from './InsightsClient'

export const metadata: Metadata = {
  title: 'Platform Insights · Lobby Market',
  description:
    'Weekly data-driven insights about the Lobby — category momentum, consensus health, argument quality, rising contributors, and law velocity.',
  openGraph: {
    title: 'Platform Insights · Lobby Market',
    description:
      'What the data is telling us this week: which categories are surging, how fast consensus is forming, and who is making the most impact.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Platform Insights · Lobby Market',
    description: 'Weekly civic data insights — momentum, quality, consensus, contributors.',
  },
}

export default function InsightsPage() {
  return <InsightsClient />
}
