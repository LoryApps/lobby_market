import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TimeMachineClient } from './TimeMachineClient'

export const metadata: Metadata = {
  title: 'Civic Time Machine · Lobby Market',
  description:
    'Revisit any day in Lobby Market history — see which topics were proposed, which became law, the strongest arguments crafted, and debates held on that date.',
  openGraph: {
    title: 'Civic Time Machine · Lobby Market',
    description:
      'Travel back to any date and explore what the Lobby looked like: laws passed, debates held, arguments written, and topics born on that day.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Time Machine · Lobby Market',
    description: 'Explore the Lobby on any date — laws, topics, arguments, and debates from that day.',
  },
}

export default function TimeMachinePage() {
  return (
    <Suspense>
      <TimeMachineClient />
    </Suspense>
  )
}
