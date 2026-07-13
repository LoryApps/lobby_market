import type { Metadata } from 'next'
import { EDMClient } from './EDMClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Early Day Motions · Lobby Market',
  description:
    'File and second formal Early Day Motions — parliamentary notices of civic concern, commendation, or call to action. EDMs with enough seconds reach the Order Paper.',
  openGraph: {
    title: 'Early Day Motions · Lobby Market',
    description:
      'The Lobby\'s parliamentary notice board. File a short formal motion on any civic matter — commendation, concern, opposition, or call to action. Gather seconds to elevate it.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Early Day Motions · Lobby Market',
    description: 'Formal civic notices that any citizen can second. The parliamentary notice board of the Lobby.',
  },
}

export default function EDMPage() {
  return <EDMClient />
}
