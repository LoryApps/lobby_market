import type { Metadata } from 'next'
import { CivicReferendumsClient } from './CivicReferendumsClient'

export const metadata: Metadata = {
  title: 'Civic Referendums · Lobby Market',
  description:
    'Platform governance votes — propose changes to how Lobby Market works, then let the community decide. Every citizen can submit a referendum; 25 votes decide the outcome.',
  openGraph: {
    title: 'Civic Referendums · Lobby Market',
    description:
      'You govern the platform. Propose features, policies, and community guidelines — then vote. Quorum decides the outcome.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Referendums · Lobby Market',
    description:
      'Platform-governance meta-voting. Propose changes. Build quorum. Shape the Lobby.',
  },
}

export default function CivicReferendumsPage() {
  return <CivicReferendumsClient />
}
