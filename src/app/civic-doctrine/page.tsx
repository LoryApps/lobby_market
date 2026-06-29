import type { Metadata } from 'next'
import { CivicDoctrineClient } from './CivicDoctrineClient'

export const metadata: Metadata = {
  title: 'The Civic Doctrine · Lobby Market',
  description:
    'The seven founding principles of the Lobby — the constitutional charter that governs how democracy works on this platform. Each article is backed by live community data showing how well the platform lives up to its ideals.',
  openGraph: {
    title: 'The Civic Doctrine · Lobby Market',
    description:
      'Seven articles. Seven principles. One constitutional charter for civic democracy on Lobby Market — with live health scores showing how well the platform honours its founding ideals.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Doctrine · Lobby Market',
    description:
      'The founding principles of the Lobby — seven constitutional articles with live health data showing democracy in action.',
  },
}

export default function CivicDoctrinePage() {
  return <CivicDoctrineClient />
}
