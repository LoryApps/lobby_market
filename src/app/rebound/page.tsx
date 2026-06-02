import type { Metadata } from 'next'
import { ReboundClient } from './ReboundClient'

export const metadata: Metadata = {
  title: 'Civic Rebound · Lobby Market',
  description:
    'Topics that went quiet — and just came roaring back. The Civic Rebound Index tracks debates that lay dormant for weeks before surging to life again.',
  openGraph: {
    title: 'Civic Rebound · Lobby Market',
    description:
      'Which civic debates went cold and are heating back up? The Rebound Index surfaces topics with 2×, 5×, or 10× their dormancy-period activity — the debates that refuse to stay settled.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Rebound · Lobby Market',
    description:
      'The civic debates that went dormant and just came back to life. Track Phoenix topics, Revivals, and Stirs in real time.',
  },
}

export default function ReboundPage() {
  return <ReboundClient />
}
