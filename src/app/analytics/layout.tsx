import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Analytics · Lobby Market',
  description:
    'Deep-dive into your voting patterns — category breakdown, accuracy over time, streak history, and how you compare to the community.',
  openGraph: {
    title: 'Analytics · Lobby Market',
    description: 'Your voting patterns, accuracy stats, and personal Lobby insights.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Analytics · Lobby Market',
    description: 'Your personal Lobby Market voting analytics.',
  },
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return children
}
