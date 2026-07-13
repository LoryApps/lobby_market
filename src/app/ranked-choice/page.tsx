import type { Metadata } from 'next'
import { RankedChoiceClient } from './RankedChoiceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Ranked Choice Polls · Lobby Market',
  description:
    'Rank policy alternatives in order of preference. Results are tallied with Instant Runoff Voting to find the consensus choice — no spoiler effect, just your honest order.',
  openGraph: {
    title: 'Ranked Choice Polls · Lobby Market',
    description:
      'Multi-option civic polls where you rank alternatives 1–N. No spoiler effect. The people\'s order of preference, surfaced by Instant Runoff Voting.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Ranked Choice Polls · Lobby Market',
    description: 'Rank policy alternatives from most to least preferred. IRV finds the true majority winner.',
  },
}

export default function RankedChoicePage() {
  return <RankedChoiceClient />
}
