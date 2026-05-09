import type { Metadata } from 'next'
import { ImposterClient } from './ImposterClient'

export const metadata: Metadata = {
  title: 'Civic Imposter · Lobby Market',
  description:
    'Daily "Spot the Fake Law" challenge. Five real established laws from the Lobby Codex — and one plausible imposter. Can you tell which one was never voted into law?',
  openGraph: {
    title: 'Civic Imposter · Lobby Market',
    description:
      'One fake law hides among five real ones from the Codex. Spot it — new challenge every day.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Imposter · Lobby Market',
    description: 'Daily fake-law detection challenge. 5 real Codex laws · 1 imposter. Find it.',
  },
}

export default function CivicImposterPage() {
  return <ImposterClient />
}
