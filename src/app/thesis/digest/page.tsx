import type { Metadata } from 'next'
import { DigestClient } from './DigestClient'

export const metadata: Metadata = {
  title: 'Thesis Weekly Digest · Lobby Market',
  description:
    'The best civic theses of the week — vindicated predictions, most-agreed positions, contested claims, and the platform\'s top forecasters.',
  openGraph: {
    title: 'Thesis Weekly Digest · Lobby Market',
    description:
      'Vindicated predictions, hotly contested claims, and the week\'s most-agreed civic theses — curated from the Lobby Oracle.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Weekly Digest · Lobby Market',
    description: 'The week in civic predictions — who was right, who was wrong, and what everyone\'s debating.',
  },
}

export default function ThesisDigestPage() {
  return <DigestClient />
}
