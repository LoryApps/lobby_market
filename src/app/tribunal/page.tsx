import type { Metadata } from 'next'
import { TribunalClient } from './TribunalClient'

export const metadata: Metadata = {
  title: 'The Civic Tribunal · Lobby Market',
  description:
    'Democratic argument review. Citizens challenge misleading or fallacious arguments; eligible jurors deliberate and deliver a verdict. 2-of-3 majority rules.',
  openGraph: {
    title: 'The Civic Tribunal · Lobby Market',
    description:
      'Peer-reviewed argument adjudication. When an argument accumulates 3 challenges, a jury of trusted citizens deliberates — and the Lobby decides.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Tribunal · Lobby Market',
    description: 'Community-driven argument review. Challenge, deliberate, verdict.',
  },
}

export default function TribunalPage() {
  return <TribunalClient />
}
