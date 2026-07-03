import type { Metadata } from 'next'
import { CivicNominationsClient } from './CivicNominationsClient'

export const metadata: Metadata = {
  title: 'Civic Nominations · Lobby Market',
  description:
    'Nominate and endorse citizens for formal civic roles — Grand Council members, Tribunal Judges, Fact Checkers, Debate Moderators, and Assembly Rapporteurs.',
  openGraph: {
    title: 'Civic Nominations · Lobby Market',
    description:
      'The Lobby\'s democratic appointment system. Citizens nominate peers for formal roles, then the community endorses. Reach the threshold and earn your seat.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Nominations · Lobby Market',
    description:
      'Nominate citizens for civic roles — Grand Council, Tribunal, Fact Checker, and more. Endorse the best candidates.',
  },
}

export default function CivicNominationsPage() {
  return <CivicNominationsClient />
}
