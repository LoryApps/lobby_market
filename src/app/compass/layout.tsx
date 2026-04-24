import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Political Compass · Lobby Market',
  description:
    'Discover where you stand — your voting history mapped onto a multi-axis political compass radar chart, broken down by category.',
  openGraph: {
    title: 'Political Compass · Lobby Market',
    description:
      'Where do your votes place you on the political spectrum? Find out with your personal Lobby Compass.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Political Compass · Lobby Market',
    description: 'Your personal political compass based on real votes.',
  },
}

export default function CompassLayout({ children }: { children: ReactNode }) {
  return children
}
