import type { Metadata } from 'next'
import { PressureClient } from './PressureClient'

export const metadata: Metadata = {
  title: 'The Civic Pressure Test · Lobby Market',
  description:
    'Debates under maximum pressure — topics where the balance is razor-thin, votes are flowing, and a small shift could flip the outcome. Your vote matters most here.',
  openGraph: {
    title: 'The Civic Pressure Test · Lobby Market',
    description:
      'Find the debates where your vote carries the most weight. Close margins, high activity, decisive moments.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Pressure Test · Lobby Market',
    description:
      'These debates are hanging by a thread. Your vote could tip them. Don\'t hold back.',
  },
}

export default function PressurePage() {
  return <PressureClient />
}
