import type { Metadata } from 'next'
import { ProclamationsClient } from './ProclamationsClient'

export const metadata: Metadata = {
  title: 'Civic Proclamations · Lobby Market',
  description:
    'The official record of Grand Council proclamations — collective civic positions issued by the top 20 citizens on Lobby Market.',
  openGraph: {
    title: 'Civic Proclamations · Lobby Market',
    description:
      'Grand Council decrees: the official collective positions of the Lobby\'s meritocratic governance body.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Proclamations · Lobby Market',
    description:
      'Official decrees from the Grand Council — the top 20 citizens governing the Lobby.',
  },
}

export default function ProclamationsPage() {
  return <ProclamationsClient />
}
