import type { Metadata } from 'next'
import { VerdictsClient } from './VerdictsClient'

export const metadata: Metadata = {
  title: 'Relay Verdicts · Lobby Market',
  description:
    'The community has spoken — see every completed relay chain and its verdict. Browse compelling wins, surprising rejections, and the closest calls in civic debate.',
  openGraph: {
    title: 'Relay Verdicts · Lobby Market',
    description:
      'Live feed of concluded relay chains and their community verdicts. Which arguments won the crowd? Which failed to convince? The results are in.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Verdicts · Lobby Market',
    description: 'Completed relay chains and their community verdicts — compelling, rejected, or contested.',
  },
}

export default function VerdictsPage() {
  return <VerdictsClient />
}
