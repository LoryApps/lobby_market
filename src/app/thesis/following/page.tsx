import type { Metadata } from 'next'
import { FollowingThesesClient } from './FollowingThesesClient'

export const metadata: Metadata = {
  title: 'Following · Theses · Lobby Market',
  description:
    'Civic theses from the people you follow — their predictions, stakes, and long-term views on society, policy, and the future.',
  openGraph: {
    title: 'Following Theses · Lobby Market',
    description: 'See what the voices you trust are staking their reputation on.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Following Theses · Lobby Market',
    description: "Civic predictions from people you follow — see who's making bold calls.",
  },
  robots: { index: false },
}

export default function FollowingThesesPage() {
  return <FollowingThesesClient />
}
