import type { Metadata } from 'next'
import { BookmarksClient } from './BookmarksClient'

export const metadata: Metadata = {
  title: 'Bookmarks · Lobby Market',
  description: 'Your saved topics and arguments — read later, reference anytime.',
  openGraph: {
    title: 'Bookmarks · Lobby Market',
    description: 'Your personal reading list of saved topics and civic arguments.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function BookmarksPage() {
  return <BookmarksClient />
}
