import type { Metadata } from 'next'
import { VerdictClient } from './VerdictClient'

export const metadata: Metadata = {
  title: 'Civic Verdict · Lobby Market',
  description:
    'A daily jury game. Read one FOR and one AGAINST argument — then render your verdict. See if you match the platform consensus. 5 rounds, max 50 pts.',
  openGraph: {
    title: 'Civic Verdict · Lobby Market',
    description:
      'You are the jury. Read real arguments from mystery debates and vote. Does your verdict match the crowd? Daily civic game.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Verdict · Lobby Market',
    description: 'Daily jury game — read arguments, render verdicts, match the consensus.',
  },
}

export default function CivicVerdictPage() {
  return <VerdictClient />
}
