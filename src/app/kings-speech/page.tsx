import type { Metadata } from 'next'
import { KingsSpeechClient } from './KingsSpeechClient'

export const metadata: Metadata = {
  title: "The King's Speech · Lobby Market",
  description:
    "The State Opening of Parliament — the ruling coalition's formal legislative programme for the session. Bills ranked by priority, debated by citizens, and responded to by the opposition.",
  openGraph: {
    title: "The King's Speech · Lobby Market",
    description:
      "The ceremonial opening of Parliament. The ruling coalition declares their legislative agenda — citizens react, the opposition responds, and democracy begins.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: "The King's Speech · Lobby Market",
    description:
      "The ruling coalition's legislative programme: flagship bills, priorities, and the civic mandate for the session.",
  },
}

export default function KingsSpeechPage() {
  return <KingsSpeechClient />
}
