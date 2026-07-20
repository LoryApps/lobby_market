import type { Metadata } from 'next'
import { ProposeClient } from './ProposeClient'

export const metadata: Metadata = {
  title: 'Propose a Market · Lobby Exchange',
  description:
    'Submit your idea for a new civic prediction market. Describe the question, resolution criteria, and settlement date. Top proposals become live markets.',
  robots: { index: false },
  openGraph: {
    title: 'Propose a Market · Lobby Exchange',
    description:
      'Help grow the Civic Exchange — propose a new prediction market and let the community vote it into existence.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function ProposePage() {
  return <ProposeClient />
}
