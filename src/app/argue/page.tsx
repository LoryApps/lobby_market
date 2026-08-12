import type { Metadata } from 'next'
import { ArgueClient } from './ArgueClient'

export const metadata: Metadata = {
  title: 'Back Your Vote · Lobby Market',
  description:
    'You voted — now say why. A focused list of topics you\'ve taken a stance on but haven\'t argued yet.',
  openGraph: {
    title: 'Back Your Vote · Lobby Market',
    description:
      'Turn your votes into arguments. Civic debate starts with a position; it\'s made by the reason behind it.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Back Your Vote · Lobby Market',
    description: 'You voted — now argue it. Lobby Market.',
  },
}

export default function ArguePage() {
  return <ArgueClient />
}
