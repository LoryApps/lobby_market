import type { Metadata } from 'next'
import { HubClient } from './HubClient'

export const metadata: Metadata = {
  title: 'The Civic Hub · Lobby Market',
  description:
    'Everything Lobby Market has to offer — organized by what you want to do. Vote, debate, analyse, discover, and shape civic outcomes.',
  openGraph: {
    title: 'The Civic Hub · Lobby Market',
    description:
      'Your complete guide to Lobby Market. Every feature, every tool, every civic superpower — organized and ready to explore.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Hub · Lobby Market',
    description: 'Everything Lobby Market has to offer — organized and ready to explore.',
  },
}

export default function HubPage() {
  return <HubClient />
}
