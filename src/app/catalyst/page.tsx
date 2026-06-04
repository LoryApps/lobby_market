import type { Metadata } from 'next'
import { CatalystClient } from './CatalystClient'

export const metadata: Metadata = {
  title: 'The Civic Catalyst · Lobby Market',
  description:
    'Which ideas triggered the most civic chain reactions? Topics ranked by how many other debates reference them — the load-bearing concepts that the whole discourse builds upon.',
  openGraph: {
    title: 'The Civic Catalyst · Lobby Market',
    description:
      'Discover the topics that sparked the most chain reactions in civic discourse — ranked by how many other debates cite them as foundational ideas.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Catalyst · Lobby Market',
    description:
      'Which topics became load-bearing pillars of civic discourse? Ranked by citation count across the wiki knowledge graph.',
  },
}

export default function CatalystPage() {
  return <CatalystClient />
}
