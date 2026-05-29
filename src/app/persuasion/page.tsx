import type { Metadata } from 'next'
import { PersuasionClient } from './PersuasionClient'

export const metadata: Metadata = {
  title: 'Civic Persuasion · Lobby Market',
  description:
    'Your argument territory — discover which civic debates you fight hardest, which side you favour, and how your voice lands across categories.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Persuasion · Lobby Market',
    description:
      'Where do you argue? How hard do you fight? See your civic argument territory, side preferences, and persuasion archetype.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Persuasion · Lobby Market',
    description: 'Your civic argument territory — categories, sides, and debating archetype decoded.',
  },
}

export default function PersuasionPage() {
  return <PersuasionClient />
}
