import type { Metadata } from 'next'
import { LordsClient } from './LordsClient'

export const metadata: Metadata = {
  title: 'The House of Lords · Lobby Market',
  description:
    'The second chamber of the Lobby Parliament. Lords — the platform\'s top civic contributors — review recently established laws, voting to ratify or send them back for reconsideration.',
  openGraph: {
    title: 'The House of Lords · Lobby Market',
    description:
      'The revising chamber. Lords review newly established laws, vote to ratify them, or send them back with amendment recommendations.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The House of Lords · Lobby Market',
    description:
      'The second chamber reviews laws passed by the Commons. Lords ratify, abstain, or send bills back for reconsideration.',
  },
}

export default function LordsPage() {
  return <LordsClient />
}
