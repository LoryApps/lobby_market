import type { Metadata } from 'next'
import { HourglassClient } from './HourglassClient'

export const metadata: Metadata = {
  title: 'Civic Hourglass · Lobby Market',
  description:
    'The full lifecycle funnel of civic topics — from first proposal through active debate, voting, and into law. See conversion rates, dwell times, and which categories move fastest.',
  openGraph: {
    title: 'Civic Hourglass · Lobby Market',
    description:
      'How many topics become law? How long does each stage take? The full civic pipeline — proposed → active → voting → law — visualised as a living funnel.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Hourglass · Lobby Market',
    description:
      'The civic pipeline: from proposal to law. Conversion rates, stage durations, and category breakdowns for every civic topic on the platform.',
  },
}

export default function HourglassPage() {
  return <HourglassClient />
}
