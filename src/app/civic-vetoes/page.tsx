import type { Metadata } from 'next'
import { CivicVetoesClient } from './CivicVetoesClient'

export const metadata: Metadata = {
  title: 'Civic Vetoes · Lobby Market',
  description:
    'Challenge established laws through collective democratic action. When enough citizens sign a Civic Veto, the law is queued for mandatory reconsideration by the community.',
  openGraph: {
    title: 'Civic Vetoes · Lobby Market',
    description:
      'The democratic override mechanism. File a Civic Veto against any established law — gather signatures and force a formal re-examination of the consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Vetoes · Lobby Market',
    description:
      'Challenge established laws. Gather signatures. Force reconsideration. Collective democratic override — live in the Lobby.',
  },
}

export default function CivicVetoesPage() {
  return <CivicVetoesClient />
}
