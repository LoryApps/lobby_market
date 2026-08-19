import type { Metadata } from 'next'
import { ResolvedThesesClient } from './ResolvedThesesClient'

export const metadata: Metadata = {
  title: 'Hall of Record · Lobby Market',
  description:
    'Every resolved civic thesis — vindicated predictions, refuted claims, and expired forecasts. See who called it right.',
  openGraph: {
    title: 'Hall of Record · Lobby Market',
    description:
      'Track the full lifecycle of civic predictions. Vindicated, refuted, or expired — every thesis resolved by history.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Hall of Record · Lobby Market',
    description:
      'See which civic predictions were vindicated, refuted, or expired. Track accuracy across predictors.',
  },
}

export default function ResolvedThesesPage() {
  return <ResolvedThesesClient />
}
