import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ThesisSearchClient } from './ThesisSearchClient'

export const metadata: Metadata = {
  title: 'Search Theses · Lobby Market',
  description:
    'Search all public civic theses on Lobby Market — find predictions by keyword, category, or status. Discover what citizens are staking their reputation on.',
  openGraph: {
    title: 'Search Civic Theses · Lobby Market',
    description:
      'Explore civic predictions from citizens across every category — economics, politics, technology, science, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Search Civic Theses · Lobby Market',
    description: 'Find civic predictions by keyword, category, or status.',
  },
}

export default function ThesisSearchPage() {
  return (
    <Suspense>
      <ThesisSearchClient />
    </Suspense>
  )
}
