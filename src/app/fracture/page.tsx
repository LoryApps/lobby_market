import type { Metadata } from 'next'
import { FractureClient } from './FractureClient'

export const metadata: Metadata = {
  title: 'The Civic Fracture · Lobby Market',
  description:
    'Where is the democratic fault line? The Civic Fracture surfaces topics that split the community closest to 50/50 — the issues where equal numbers of citizens argue FOR and AGAINST with equal force. These are the debates democracy was built to hold.',
  openGraph: {
    title: 'The Civic Fracture · Lobby Market',
    description:
      'Topics closest to 50/50 with the highest engagement — the fault lines of civic discourse where neither side can convince the other.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Fracture · Lobby Market',
    description:
      'Where are the deepest fault lines in civic debate? Topics scored by vote split × engagement × argument balance.',
  },
}

export default function FracturePage() {
  return <FractureClient />
}
