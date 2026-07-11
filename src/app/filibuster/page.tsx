import type { Metadata } from 'next'
import { FilibusterClient } from './FilibusterClient'

export const metadata: Metadata = {
  title: 'Civic Filibuster · Lobby Market',
  description:
    'The parliamentary floor of the Lobby — citizens can file filibusters on topics heading to a vote, demanding more debate time. Vote to force the vote (cloture) or extend the debate window (second).',
  openGraph: {
    title: 'Civic Filibuster · Lobby Market',
    description:
      'Any citizen can filibuster a voting-phase topic to demand more debate. Enough cloture votes end the filibuster; enough seconds extend the debate window.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Filibuster · Lobby Market',
    description:
      'Parliamentary debate extension — file a filibuster or vote to force the vote through.',
  },
}

export default function FilibusterPage() {
  return <FilibusterClient />
}
