import type { Metadata } from 'next'
import { WhispersClient } from './WhispersClient'

export const metadata: Metadata = {
  title: 'Civic Whisper Board · Lobby Market',
  description:
    'The debates where the Lobby votes in silence. Topics with high vote counts but almost no arguments — the unspoken consensus, the uncomfortable truths, and the sacred cows of civic discourse.',
  openGraph: {
    title: 'Civic Whisper Board · Lobby Market',
    description:
      'Where does democracy go quiet? Discover the topics that the Lobby votes on unanimously — but never argues about. The unspoken consensus of civic life.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Whisper Board · Lobby Market',
    description:
      'High votes. Near-zero arguments. The debates the Lobby treats as obvious — too obvious to argue about.',
  },
}

export default function WhispersPage() {
  return <WhispersClient />
}
