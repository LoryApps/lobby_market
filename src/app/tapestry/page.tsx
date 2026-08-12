import type { Metadata } from 'next'
import { TapestryClient } from './TapestryClient'

export const metadata: Metadata = {
  title: 'Civic Tapestry · Lobby Market',
  description:
    'Every established law woven into a single tapestry — grouped by category, coloured by consensus strength, sized by democratic mandate. The full fabric of the civic codex at a glance.',
  openGraph: {
    title: 'Civic Tapestry · Lobby Market',
    description:
      'All established laws woven together — each thread a law, each stripe a category. The democratic fabric of the civic codex.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Tapestry · Lobby Market',
    description:
      'The full civic codex as a woven tapestry — laws grouped by category, coloured by consensus.',
  },
}

export default function TapestryPage() {
  return <TapestryClient />
}
