import type { Metadata } from 'next'
import { InertiaClient } from './InertiaClient'

export const metadata: Metadata = {
  title: 'Civic Inertia Index · Lobby Market',
  description:
    'Which debates absorbed the most argument and engagement without budging? The Civic Inertia Index finds the bedrock beliefs of the platform — topics where no amount of argument could shift the community\'s verdict.',
  openGraph: {
    title: 'Civic Inertia Index · Lobby Market',
    description:
      'Some debates are immovable. The Inertia Index finds topics with strong consensus AND high engagement — the bedrock beliefs that resisted every argument.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Inertia Index · Lobby Market',
    description:
      'The debates that absorbed everything — and didn\'t move. Ranked by consensus strength × engagement depth.',
  },
}

export default function InertiaPage() {
  return <InertiaClient />
}
