import type { Metadata } from 'next'
import { VitalsClient } from './VitalsClient'

export const metadata: Metadata = {
  title: 'Civic Vitals · Lobby Market',
  description:
    'Live discourse quality dashboard — argument grade distribution, deliberation depth, consensus health, and evidence citation rates across the entire platform.',
  openGraph: {
    title: 'Civic Vitals · Lobby Market',
    description:
      'How healthy is our democracy? Track argument quality, deliberation depth, and consensus velocity in real time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Vitals · Lobby Market',
    description:
      'Platform discourse health at a glance — quality score, grade distribution, and consensus metrics.',
  },
}

export default function VitalsPage() {
  return <VitalsClient />
}
