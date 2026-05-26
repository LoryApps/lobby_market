import type { Metadata } from 'next'
import { CivicDispatchClient } from './CivicDispatchClient'

export const metadata: Metadata = {
  title: 'The Civic Dispatch · Lobby Market',
  description:
    'Tonight\'s top story from every civic category — the single most significant debate happening right now in Economics, Politics, Technology, and 7 more domains.',
  openGraph: {
    title: 'The Civic Dispatch · Lobby Market',
    description:
      'One story per category. The most urgent civic debate happening right now — curated by signal score across all 10 policy domains.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Dispatch · Lobby Market',
    description: 'The definitive civic briefing — one top story per category, live from the Lobby.',
  },
}

export default function CivicDispatchPage() {
  return <CivicDispatchClient />
}
