import type { Metadata } from 'next'
import { SessionClient } from './SessionClient'

export const metadata: Metadata = {
  title: 'Daily Legislative Session · Lobby Market',
  description:
    'Your daily 5-topic civic voting session. Five curated debates — vote on each to complete the session and earn bonus Clout. A new session every day.',
  openGraph: {
    title: 'Daily Legislative Session · Lobby Market',
    description:
      'Five curated debates, refreshed every day. Vote on all five to earn a Clout bonus and complete your civic duty.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Daily Legislative Session · Lobby Market',
    description: 'Five debates. One session. Fresh every day. Vote to earn your Clout bonus.',
  },
}

export default function SessionPage() {
  return <SessionClient />
}
