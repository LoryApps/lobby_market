import type { Metadata } from 'next'
import { GalaxyClient } from './GalaxyClient'

export const metadata: Metadata = {
  title: 'Civic Galaxy · Lobby Market',
  description:
    'An interactive star-map of every civic debate on Lobby Market. Each star is a topic — sized by votes, colored by consensus, clustered by category. Explore the civic universe.',
  openGraph: {
    title: 'Civic Galaxy · Lobby Market',
    description:
      'Navigate every civic debate in one immersive view. Discover emerging topics, established laws, and contested debates mapped as a living galaxy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Galaxy · Lobby Market',
    description: 'Every civic topic mapped as a star. Explore the galaxy of democratic debate.',
  },
}

export default function GalaxyPage() {
  return <GalaxyClient />
}
