import type { Metadata } from 'next'
import { MirrorClient } from './MirrorClient'

export const metadata: Metadata = {
  title: 'Civic Mirror · Lobby Market',
  description:
    'Five topics. Vote your gut — FOR or AGAINST. Then see how you compare to the community\'s majority. A daily mirror of where you stand.',
  openGraph: {
    title: 'Civic Mirror · Lobby Market',
    description:
      'Vote your gut on 5 real civic topics. Instant reveal: are you with the majority or a contrarian outlier?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Mirror · Lobby Market',
    description: 'Daily gut-check: 5 civic topics · vote FOR or AGAINST · see how you compare to the Lobby majority.',
  },
}

export default function CivicMirrorPage() {
  return <MirrorClient />
}
