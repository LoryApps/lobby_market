import type { Metadata } from 'next'
import { NotesClient } from './NotesClient'

export const metadata: Metadata = {
  title: 'Civic Notes · Lobby Market',
  description:
    'Your private civic research notes — annotate debates, save your thinking, and build a personal knowledge base on every topic you follow.',
  openGraph: {
    title: 'Civic Notes · Lobby Market',
    description:
      'Private notes tied to debates — capture insights, track your thinking, and build your own civic knowledge base.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Notes · Lobby Market',
    description: 'Your private research notes on Lobby Market debates — organized, searchable, always yours.',
  },
  robots: { index: false },
}

export default function NotesPage() {
  return <NotesClient />
}
