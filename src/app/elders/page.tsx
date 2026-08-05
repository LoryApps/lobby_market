import type { Metadata } from 'next'
import { EldersClient } from './EldersClient'

export const metadata: Metadata = {
  title: 'The Civic Elders · Lobby Market',
  description:
    "The oldest unresolved debates on Lobby Market — questions the community still hasn't answered. Some have been open for months. Come help break the stalemate.",
  openGraph: {
    title: 'The Civic Elders · Lobby Market',
    description:
      "Debates that have stood the test of time. These are the questions the civic community still hasn't resolved. Your vote could finally tip the balance.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Elders · Lobby Market',
    description:
      "The oldest unresolved debates — some open for months. Come help the community reach a verdict.",
  },
}

export default function EldersPage() {
  return <EldersClient />
}
