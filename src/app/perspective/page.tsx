import type { Metadata } from 'next'
import { PerspectiveClient } from './PerspectiveClient'

export const metadata: Metadata = {
  title: 'Perspective Swap · Lobby Market',
  description:
    'Confront the strongest case for the other side. Pick any civic topic, choose your position, and Claude generates a genuine steel-man argument for the opposing view.',
  openGraph: {
    title: 'Perspective Swap · Lobby Market',
    description:
      'Not to change your mind — just to ensure you understand the best case for the other side. A civic anti-echo-chamber tool.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Perspective Swap · Lobby Market',
    description:
      "See the strongest honest argument against your own position. Built to reduce civic echo chambers.",
  },
}

export default function PerspectivePage() {
  return <PerspectiveClient />
}
