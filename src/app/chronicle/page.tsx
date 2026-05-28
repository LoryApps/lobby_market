import type { Metadata } from 'next'
import { ChronicleClient } from './ChronicleClient'

export const metadata: Metadata = {
  title: 'The Civic Chronicle · Lobby Market',
  description:
    'A chronological record of every major event in the Lobby — laws established, debates held, and notable topics proposed. The complete historical archive of civic democracy in action.',
  openGraph: {
    title: 'The Civic Chronicle · Lobby Market',
    description:
      'Every law, every debate, every major proposal — the complete historical record of the Lobby, month by month.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Chronicle · Lobby Market',
    description: 'The full historical archive: every law passed, every debate held, every proposal made on Lobby Market.',
  },
}

export default function ChroniclePage() {
  return <ChronicleClient />
}
