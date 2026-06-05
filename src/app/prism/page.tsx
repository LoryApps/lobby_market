import type { Metadata } from 'next'
import { PrismClient } from './PrismClient'

export const metadata: Metadata = {
  title: 'The Civic Prism · Lobby Market',
  description:
    'The same civic question, refracted through two completely different lenses. The Civic Prism surfaces topics where FOR and AGAINST don\'t just disagree — they make entirely different cases, appeal to different values, and inhabit parallel epistemic worlds.',
  openGraph: {
    title: 'The Civic Prism · Lobby Market',
    description:
      'Where the FOR and AGAINST cases diverge most completely — bilateral debates where each side argues from an entirely different reality.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Prism · Lobby Market',
    description:
      'Civic topics where both sides argue with equal force — but from entirely different angles. The parallel realities of democratic debate.',
  },
}

export default function PrismPage() {
  return <PrismClient />
}
