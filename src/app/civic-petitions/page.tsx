import type { Metadata } from 'next'
import { CivicPetitionsClient } from './CivicPetitionsClient'

export const metadata: Metadata = {
  title: 'Civic Petitions · Lobby Market',
  description:
    'Citizen-initiated petitions to force formal civic action — hearings, referendums, and assembly sessions. Sign, create, and track democratic demands.',
  openGraph: {
    title: 'Civic Petitions · Lobby Market',
    description:
      'When debate is not enough. File a formal petition to demand a committee hearing, trigger a referendum, or convene a Citizens Assembly. Signatures unlock democratic action.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Petitions · Lobby Market',
    description:
      'File and sign petitions that force civic action — hearings, referendums, and assembly convening.',
  },
}

export default function CivicPetitionsPage() {
  return <CivicPetitionsClient />
}
