import type { Metadata } from 'next'
import { WhipsClient } from './WhipsClient'

export const metadata: Metadata = {
  title: "The Whip's Office · Lobby Market",
  description:
    "Coalition voting guidance — three-line whips, free votes, and party discipline. Coalition leaders issue formal directives; track how members vote.",
  openGraph: {
    title: "The Whip's Office · Lobby Market",
    description:
      'Issue and track coalition whip guidance. See which coalitions have mandated votes on active topics and monitor member compliance.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "The Whip's Office · Lobby Market",
    description: 'Coalition voting guidance — three-line whips, free votes, and party discipline.',
  },
}

export default function WhipsPage() {
  return <WhipsClient />
}
