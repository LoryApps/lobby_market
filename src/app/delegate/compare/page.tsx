import type { Metadata } from 'next'
import { CompareDelegatesClient } from './CompareDelegatesClient'

export const metadata: Metadata = {
  title: 'Compare Delegates · Lobby Market',
  description:
    'Pick two citizens and compare them side-by-side to decide who better represents your civic views. See vote alignment, category expertise, and community trust for each delegate.',
  robots: { index: false },
  openGraph: {
    title: 'Compare Delegates · Lobby Market',
    description:
      'Head-to-head delegate comparison — see who votes more like you before trusting them with your voice.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function CompareDelegatesPage() {
  return <CompareDelegatesClient />
}
