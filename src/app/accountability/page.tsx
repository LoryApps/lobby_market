import type { Metadata } from 'next'
import { AccountabilityClient } from './AccountabilityClient'

export const metadata: Metadata = {
  title: 'Civic Accountability · Lobby Market',
  description:
    'The Civic Oath Roll — a public record of every citizen who has taken the oath of good-faith participation, and how they have lived it. Ranked by post-oath civic engagement.',
  openGraph: {
    title: 'Civic Accountability · Lobby Market',
    description:
      "Every oath-taker, their chosen civic value, and their engagement since the pledge. The platform's public record of civic commitment in action.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Accountability · Lobby Market',
    description:
      'Who took the Civic Oath — and how they\'ve lived it. A public record of commitment and participation.',
  },
}

export default function AccountabilityPage() {
  return <AccountabilityClient />
}
