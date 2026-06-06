import type { Metadata } from 'next'
import { SparkClient } from './SparkClient'

export const metadata: Metadata = {
  title: 'Civic Spark · Lobby Market',
  description:
    'Discover a hidden civic debate you haven\'t seen yet. One random, under-explored topic — vote, argue, and ignite the conversation.',
  openGraph: {
    title: 'Civic Spark · Lobby Market',
    description:
      'The Lobby has thousands of debates. Civic Spark surfaces one you haven\'t seen yet — under-explored, high-quality, waiting for your voice.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Spark · Lobby Market',
    description: 'Discover a hidden debate. Vote. Argue. Change the outcome.',
  },
}

export default function SparkPage() {
  return <SparkClient />
}
