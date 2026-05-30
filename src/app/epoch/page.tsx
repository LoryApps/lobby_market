import type { Metadata } from 'next'
import { EpochClient } from './EpochClient'

export const metadata: Metadata = {
  title: 'The Civic Epoch · Lobby Market',
  description:
    'Every period of the platform\'s civic history, characterised by its defining events. Laws passed, consensus shifts, and the mood of democratic debate — month by month.',
  openGraph: {
    title: 'The Civic Epoch · Lobby Market',
    description:
      'The platform\'s history in epochs — Legislative Eras, Great Debates, Progressive Waves, and Civic Surges. Every period has a character. This is the civic story of the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Epoch · Lobby Market',
    description:
      'Every month of democratic history on Lobby Market — each given a character by its laws, debates, and consensus direction.',
  },
}

export default function EpochPage() {
  return <EpochClient />
}
