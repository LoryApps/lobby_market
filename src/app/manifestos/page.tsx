import type { Metadata } from 'next'
import { ManifestosClient } from './ManifestosClient'

export const metadata: Metadata = {
  title: 'Civic Manifestos · Lobby Market',
  description:
    'Discover the civic archetypes of Lobby Market citizens. Browse AI-generated political manifestos built from real voting histories — Progressive Reformers, Pragmatic Centrists, Liberty Hawks, and more.',
  openGraph: {
    title: 'Civic Manifestos · Lobby Market',
    description:
      'Every citizen\'s political soul, in their own words. Browse published civic manifestos — AI-generated from real voting records across the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Manifestos · Lobby Market',
    description: 'Browse civic archetypes. Find your political kin on Lobby Market.',
  },
}

export default function ManifestosPage() {
  return <ManifestosClient />
}
