import type { Metadata } from 'next'
import { EmergencyDebatesClient } from './EmergencyDebatesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Emergency Debates · Lobby Market',
  description:
    'Any citizen may apply for an emergency debate on a matter of urgent civic importance. If endorsed by 10 fellow citizens, the Speaker convenes an immediate debate. Standing Order 24 of the Lobby Parliament.',
  openGraph: {
    title: 'Emergency Debates · Lobby Market',
    description:
      'Fast-tracked debates on urgent civic matters — proposed by citizens, endorsed by the community, and convened by the Speaker. The most urgent voice in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Emergency Debates · Lobby Market',
    description:
      'Propose an emergency debate on any matter of urgent civic importance. Gather endorsements — and the Speaker will convene the chamber.',
  },
}

export default function EmergencyDebatesPage() {
  return <EmergencyDebatesClient />
}
