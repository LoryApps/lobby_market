import type { Metadata } from 'next'
import { ContrarianClient } from './ContrarianClient'

export const metadata: Metadata = {
  title: 'Maverick Tracker · Lobby Market',
  description: "See your minority-position votes and whether they're being vindicated. Track your contrarian stance across every civic debate on the platform.",
  openGraph: {
    title: 'Maverick Tracker · Lobby Market',
    description: 'Your contrarian positions — gaining ground or being overruled?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Maverick Tracker · Lobby Market',
    description: 'Track which of your minority votes are being vindicated.',
  },
}

export default function ContrarianPage() {
  return <ContrarianClient />
}
