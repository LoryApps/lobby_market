import type { Metadata } from 'next'
import { ComebackClient } from './ComebackClient'

export const metadata: Metadata = {
  title: 'Comeback Debates · Lobby Market',
  description:
    'Civic debates that went dormant — silent for days — and have just been revived by fresh votes in the last 24 hours. These are the conversations the platform thought were over.',
  openGraph: {
    title: 'Comeback Debates · Lobby Market',
    description:
      'Debates the community thought were over — brought back to life. Someone reignited these civic conversations after days of silence.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Comeback Debates · Lobby Market',
    description:
      'Civic debates that went silent and just came back. The conversations nobody expected to continue — until now.',
  },
}

export default function ComebackPage() {
  return <ComebackClient />
}
