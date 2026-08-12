import type { Metadata } from 'next'
import { ArgumentMapClient } from './ArgumentMapClient'

export const metadata: Metadata = {
  title: 'Argument Map · Lobby Market',
  description:
    'A scatter plot of every argument on the platform — plotted by AI quality score against community upvotes. Discover which arguments are both compelling and well-received.',
  openGraph: {
    title: 'Argument Map · Lobby Market',
    description:
      'See every argument mapped by quality score vs upvotes. Blue = FOR. Red = AGAINST. Size = recency.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Map · Lobby Market',
    description: 'Argument quality vs community reception — every voice on the platform, plotted.',
  },
}

export default function ArgumentMapPage() {
  return <ArgumentMapClient />
}
