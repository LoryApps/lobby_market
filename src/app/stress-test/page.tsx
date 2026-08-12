import type { Metadata } from 'next'
import { StressTestClient } from './StressTestClient'

export const metadata: Metadata = {
  title: 'Argument Stress Test · Lobby Market',
  description:
    'Attack your civic argument from five angles before your opponents do. Empirical, logical, practical, systemic, and alternatives — get a vulnerability score and defense tips for each.',
  openGraph: {
    title: 'Argument Stress Test · Lobby Market',
    description:
      'Find the weak points in any civic argument. Five AI-powered attack vectors, vulnerability scores, and actionable defense tips.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Stress Test · Lobby Market',
    description: 'How stress-proof is your argument? Five attack vectors reveal every weak point.',
  },
}

export default function StressTestPage() {
  return <StressTestClient />
}
