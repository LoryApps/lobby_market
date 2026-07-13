import type { Metadata } from 'next'
import { HansardClient } from './HansardClient'

export const metadata: Metadata = {
  title: 'The Civic Hansard · Lobby Market',
  description:
    'The official daily record of all parliamentary proceedings — laws established, Early Day Motions filed, PMQ sessions, committee reports, debates concluded, and new motions proposed.',
  openGraph: {
    title: 'The Civic Hansard · Lobby Market',
    description:
      'The Lobby\'s living institutional memory: every law, motion, debate, and parliamentary proceeding — recorded in chronological order.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Hansard · Lobby Market',
    description: 'Official parliamentary record — laws, EDMs, PMQs, committee reports, and debates in one daily log.',
  },
}

export default function HansardPage() {
  return <HansardClient />
}
