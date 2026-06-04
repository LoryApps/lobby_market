import type { Metadata } from 'next'
import { CanvassClient } from './CanvassClient'

export const metadata: Metadata = {
  title: 'Civic Canvass · Lobby Market',
  description:
    'Discover which high-engagement debates you haven\'t voted on yet — your personal civic blind spots, ranked by community activity.',
  openGraph: {
    title: 'Civic Canvass · Lobby Market',
    description:
      'Find the popular debates you\'ve been missing. Track your civic coverage across every category and close the gaps in your voting record.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Canvass · Lobby Market',
    description:
      'Popular debates you haven\'t voted on yet — your personal civic blind spots.',
  },
}

export default function CanvassPage() {
  return <CanvassClient />
}
