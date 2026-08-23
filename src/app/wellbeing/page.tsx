import type { Metadata } from 'next'
import { WellbeingClient } from './WellbeingClient'

export const metadata: Metadata = {
  title: 'Civic Wellbeing · Lobby Market',
  description:
    'A multi-dimensional health report for civic discourse — argument quality, community mood, consensus health, deliberation depth, and prediction accuracy over 7, 30, or 90 days.',
  openGraph: {
    title: 'Civic Wellbeing · Lobby Market',
    description:
      'Track how your civic platform is thriving across five key discourse dimensions.',
  },
}

export default function WellbeingPage() {
  return <WellbeingClient />
}
