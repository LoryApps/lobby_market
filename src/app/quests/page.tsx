import type { Metadata } from 'next'
import { QuestsClient } from './QuestsClient'

export const metadata: Metadata = {
  title: 'Civic Quests · Lobby Market',
  description:
    'Progress through structured civic achievement tracks — Voter, Debater, Scholar, and Builder. Complete quests, earn Clout, and level up your civic profile.',
  openGraph: {
    title: 'Civic Quests · Lobby Market',
    description:
      'Structured progression paths that reward every kind of civic participation. Earn Clout as you grow.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Quests · Lobby Market',
    description: 'Level up your civic participation with structured quest tracks.',
  },
}

export default function QuestsPage() {
  return <QuestsClient />
}
