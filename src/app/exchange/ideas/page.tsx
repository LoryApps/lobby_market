import type { Metadata } from 'next'
import { IdeasClient } from './IdeasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Ideas · Lobby Exchange',
  description:
    'Community prediction theses — share your market call, target price, and reasoning on any live civic debate. Vote on the best ideas.',
  robots: { index: false },
  openGraph: {
    title: 'Market Ideas · Lobby Exchange',
    description:
      'Crowd-sourced prediction theses for civic markets. Share your thesis, set a target, and let the community decide.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Ideas · Lobby Exchange',
    description: 'Community-curated prediction theses for civic consensus markets.',
  },
}

export default function IdeasPage() {
  return <IdeasClient />
}
