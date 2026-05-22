import type { Metadata } from 'next'
import { WatershedClient } from './WatershedClient'

export const metadata: Metadata = {
  title: 'The Civic Watershed · Lobby Market',
  description:
    'The definitive record of consensus achieved — the Lobby\'s most decisive mandates, closest calls, highest-turnout debates, and fastest enacted laws.',
  openGraph: {
    title: 'The Civic Watershed · Lobby Market',
    description:
      'Every law represents democracy at a moment in time. Explore the mandates, razor-edge calls, and record-breaking debates that shaped the Lobby\'s legislative history.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Watershed · Lobby Market',
    description:
      'The legislative hall of records — decisive mandates, closest calls, and fastest-enacted laws on Lobby Market.',
  },
}

export default function WatershedPage() {
  return <WatershedClient />
}
