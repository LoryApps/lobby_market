import type { Metadata } from 'next'
import { BingoClient } from './BingoClient'

export const metadata: Metadata = {
  title: 'Civic Bingo · Lobby Market',
  description:
    'A 5×5 weekly bingo card of civic topics — laws that pass mark your squares. First to five in a row wins.',
  openGraph: {
    title: 'Civic Bingo · Lobby Market',
    description: 'Mark off civic topics as they become law. Get five in a row. BINGO.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Bingo · Lobby Market',
    description: 'The weekly civic game — track which topics become law and get your bingo.',
  },
}

export default function BingoPage() {
  return <BingoClient />
}
