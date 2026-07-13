import type { Metadata } from 'next'
import { WestminsterHallClient } from './WestminsterHallClient'

export const metadata: Metadata = {
  title: 'Westminster Hall · Lobby Market',
  description:
    'The secondary chamber — where any citizen can request a backbench debate slot and lead a focused discussion on any civic topic. No formal sides, no votes: just open deliberation.',
  openGraph: {
    title: 'Westminster Hall · Lobby Market',
    description:
      'Backbench debates for citizens. Request a session, gather supporters, and lead a focused discussion in the secondary chamber of the Lobby Parliament.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Westminster Hall · Lobby Market',
    description:
      'Any citizen can take the floor. Request a Westminster Hall debate slot, gather five supporters, and lead the discussion.',
  },
}

export default function WestminsterHallPage() {
  return <WestminsterHallClient />
}
