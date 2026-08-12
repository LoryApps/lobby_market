import type { Metadata } from 'next'
import { OrreryClient } from './OrreryClient'

export const metadata: Metadata = {
  title: 'Civic Orrery · Lobby Market',
  description:
    'A solar system of civic debate — every active topic orbits the Consensus Core as a planet. Size = votes, distance = polarization, color = majority side. An animated map of democracy in motion.',
  openGraph: {
    title: 'Civic Orrery · Lobby Market',
    description:
      'Every active debate as a planet in orbit around the Consensus Core. Watch democracy move in real time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Orrery · Lobby Market',
    description:
      'Debates as planets orbiting a consensus sun. Size = votes. Distance = polarization. Click to enter any debate.',
  },
}

export default function OrreryPage() {
  return <OrreryClient />
}
