import type { Metadata } from 'next'
import { CivicConventionClient } from './CivicConventionClient'

export const metadata: Metadata = {
  title: 'The Civic Constitutional Convention · Lobby Market',
  description:
    'The highest deliberative body on Lobby Market — where citizens propose, debate, and ratify amendments to the founding Civic Doctrine. A supermajority of 75% is required for any change to take effect.',
  openGraph: {
    title: 'The Civic Constitutional Convention · Lobby Market',
    description:
      'Propose amendments to the platform\'s founding principles. Every change to the Civic Doctrine must pass through the Constitutional Convention with a 75% supermajority. Democracy at its highest form.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Constitutional Convention · Lobby Market',
    description:
      'The constitutional process — propose, deliberate, ratify. Where the founding principles of the Lobby are renewed.',
  },
}

export default function CivicConventionPage() {
  return <CivicConventionClient />
}
