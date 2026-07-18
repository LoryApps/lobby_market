import type { Metadata } from 'next'
import { MissionControlClient } from './MissionControlClient'

export const metadata: Metadata = {
  title: 'Mission Control · Lobby Market',
  description:
    'Your personalized civic command center — pending votes, active predictions, upcoming debates, achievements, and platform pulse in one place.',
  openGraph: {
    title: 'Mission Control · Lobby Market',
    description: 'Your civic command center: pending votes, predictions, debates, and platform health at a glance.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function MissionControlPage() {
  return <MissionControlClient />
}
