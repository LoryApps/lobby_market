import type { Metadata } from 'next'
import { ExtremesClient } from './ExtremesClient'

export const metadata: Metadata = {
  title: 'Civic Extremes · Lobby Market',
  description:
    'The most contested debates (near 50/50) and the strongest civic mandates (>80% consensus). See where the community is divided vs. decisive.',
  openGraph: {
    title: 'Civic Extremes · Lobby Market',
    description:
      'Where the Lobby is most divided — and where it has spoken with one voice. Fault lines and mandates, live.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Extremes · Lobby Market',
    description: 'The most contested debates and the strongest civic mandates, live.',
  },
}

export default function ExtremesPage() {
  return <ExtremesClient />
}
