import type { Metadata } from 'next'
import { ReelClient } from './ReelClient'

export const metadata: Metadata = {
  title: 'Civic Reel · Lobby Market',
  description:
    'Swipe through the best civic arguments on Lobby Market — one at a time, full-screen. FOR or AGAINST, upvote what moves you.',
  openGraph: {
    title: 'Civic Reel · Lobby Market',
    description:
      "TikTok-style argument feed. Swipe through the most compelling FOR and AGAINST arguments on the Lobby's biggest debates.",
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Reel · Lobby Market',
    description: 'Swipe through civic arguments. Upvote. Engage. One at a time.',
  },
}

export default function ReelPage() {
  return <ReelClient />
}
