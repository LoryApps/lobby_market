import type { Metadata } from 'next'
import { HearingsClient } from './HearingsClient'

export const metadata: Metadata = {
  title: 'Civic Committee Hearings · Lobby Market',
  description:
    'Formal committee sessions where citizens submit written testimony on contested civic topics before they go to a vote. Each committee reviews evidence and issues a recommendation.',
  openGraph: {
    title: 'Civic Committee Hearings · Lobby Market',
    description:
      'Structured pre-vote testimony sessions — where citizens go on record with evidence and reasoning before the Lobby decides. Each committee issues a formal recommendation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Committee Hearings · Lobby Market',
    description:
      'Submit testimony. Shape the vote. Committee hearings bring evidence-based deliberation to civic democracy.',
  },
}

export default function HearingsPage() {
  return <HearingsClient />
}
