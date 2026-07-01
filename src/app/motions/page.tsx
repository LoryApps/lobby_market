import type { Metadata } from 'next'
import { MotionsClient } from './MotionsClient'

export const metadata: Metadata = {
  title: 'Civic Motions · Lobby Market',
  description:
    'The Lobby\'s unified legislative floor: every active Citizens\' Assembly, Grand Council motion, civic petition, referendum, and veto challenge in one place.',
  openGraph: {
    title: 'Civic Motions · Lobby Market',
    description:
      'Track every formal civic action in motion — sortition assemblies, council resolutions, citizen petitions, referendums, and democratic veto challenges. The Lobby\'s live legislative board.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Motions · Lobby Market',
    description:
      'Every active civic motion on one board — assemblies, council votes, petitions, referendums, and veto challenges.',
  },
}

export default function MotionsPage() {
  return <MotionsClient />
}
