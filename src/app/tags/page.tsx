import type { Metadata } from 'next'
import { TagsClient } from './TagsClient'

export const metadata: Metadata = {
  title: 'Topic Tags · Lobby Market',
  description:
    'Browse all civic debates by keyword tag — from climate and taxation to democracy and AI. Find every topic that matters to you.',
  openGraph: {
    title: 'Topic Tags · Lobby Market',
    description:
      'Explore Lobby Market debates by tag — climate, economy, justice, education, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Topic Tags · Lobby Market',
    description: 'Browse civic debates by keyword tag.',
  },
}

export default function TagsPage() {
  return <TagsClient />
}
