import type { Metadata } from 'next'
import { LegacyClient } from './LegacyClient'

export const metadata: Metadata = {
  title: 'Civic Legacy · Lobby Market',
  description:
    'Your permanent civic record — laws you helped pass, arguments that shaped debate, milestones along the journey. The Lobby remembers every voice that shaped it.',
  openGraph: {
    title: 'Civic Legacy · Lobby Market',
    description:
      "Laws authored. Arguments that moved people. Debates won. This is your civic story — every mark you've left on the Lobby.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Legacy · Lobby Market',
    description:
      "Laws authored, debates won, arguments that moved people. Your permanent civic record on Lobby Market.",
  },
}

export default function LegacyPage() {
  return <LegacyClient />
}
