import type { Metadata } from 'next'
import { CivicRegistryClient } from './CivicRegistryClient'

export const metadata: Metadata = {
  title: 'Civic Registry · Lobby Market',
  description:
    'The live state of all civic institutions — assemblies in session, open hearings, ombudsman cases, pending appeals, council motions, and active petitions.',
  openGraph: {
    title: 'Civic Registry · Lobby Market',
    description: 'Live dashboard for all civic institutions on the Lobby Market platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Registry · Lobby Market',
    description: 'Live civic institution dashboard — assemblies, hearings, ombudsman, appeals, motions, petitions.',
  },
}

export default function CivicRegistryPage() {
  return <CivicRegistryClient />
}
