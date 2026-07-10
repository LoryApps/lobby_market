import type { Metadata } from 'next'
import { WeeklyRelayClient } from './WeeklyRelayClient'

export const metadata: Metadata = {
  title: 'Relay of the Week · Lobby Market',
  description:
    "This week's most compelling civic relay chain — a collaborative argument built leg by leg by the community. Browse past weeks and cast your verdict.",
  openGraph: {
    title: 'Relay of the Week · Lobby Market',
    description:
      'The community crowns one relay chain each week. Collaborative civic argument at its finest — read the chain, meet the contributors, cast your verdict.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay of the Week · Lobby Market',
    description: "This week's most compelling relay chain, built collaboratively by Lobby citizens.",
  },
}

export default function WeeklyRelayPage() {
  return <WeeklyRelayClient />
}
