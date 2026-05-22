import type { Metadata } from 'next'
import { DossierClient } from './DossierClient'

export const metadata: Metadata = {
  title: 'Civic Dossier · Lobby Market',
  description:
    'Your complete civic identity in one glance — votes cast, laws shaped, debates won, and the categories that define your civic fingerprint.',
  openGraph: {
    title: 'Civic Dossier · Lobby Market',
    description:
      'A concise snapshot of your civic record: every vote, argument, and law you helped create on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Dossier · Lobby Market',
    description: 'Your civic identity card — stats, category fingerprint, and legacy in one view.',
  },
}

export default function DossierPage() {
  return <DossierClient />
}
