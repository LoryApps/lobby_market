import type { Metadata } from 'next'
import { RelayAchievementsClient } from './RelayAchievementsClient'

export const metadata: Metadata = {
  title: 'Relay Achievements · Lobby Market',
  description:
    'Earn badges for building civic relay chains — from your first chain link to becoming a legendary Relay Maestro. Track your progress and see who else is climbing the ranks.',
  openGraph: {
    title: 'Relay Achievements · Lobby Market',
    description:
      '10 relay badges, 4 tiers. Start chains, add legs, earn compelling votes, and climb to Relay Legend status.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Achievements · Lobby Market',
    description: 'Earn relay badges by building civic argument chains on Lobby Market.',
  },
}

export default function RelayAchievementsPage() {
  return <RelayAchievementsClient />
}
