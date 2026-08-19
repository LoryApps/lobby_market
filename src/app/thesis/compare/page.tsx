import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ThesisCompareClient } from './ThesisCompareClient'

export const metadata: Metadata = {
  title: 'Thesis Compare · Lobby Market',
  description:
    'Compare two civic theses side-by-side — agreement splits, resolution timelines, community engagement, and shared themes.',
  openGraph: {
    title: 'Thesis Compare · Lobby Market',
    description:
      'Put two civic predictions head-to-head. See who agrees, who disagrees, and how they relate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Compare · Lobby Market',
    description: 'Compare two civic predictions side-by-side on Lobby Market.',
  },
}

export default function ThesisComparePage() {
  return (
    <Suspense>
      <ThesisCompareClient />
    </Suspense>
  )
}
