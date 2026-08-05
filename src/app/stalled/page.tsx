import type { Metadata } from 'next'
import { StalledClient } from './StalledClient'

export const metadata: Metadata = {
  title: 'Stalled Debates · Lobby Market',
  description:
    'Civic debates that had momentum but went silent — the forgotten questions. These topics were actively voted on but have received no new votes in 5+ days.',
  openGraph: {
    title: 'Stalled Debates · Lobby Market',
    description:
      'The forgotten civic questions. These debates had real momentum — votes, arguments, heat — and then the conversation stopped. Some of the most important questions on the platform, waiting to be rediscovered.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Stalled Debates · Lobby Market',
    description:
      'Debates that had momentum but went silent. Real civic questions left without an answer — waiting for someone to reignite the conversation.',
  },
}

export default function StalledPage() {
  return <StalledClient />
}
