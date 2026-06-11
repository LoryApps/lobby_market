import type { Metadata } from 'next'
import { MandateClient } from './MandateClient'

export const metadata: Metadata = {
  title: 'The Civic Mandate · Lobby Market',
  description:
    'Every topic where the community has reached decisive consensus — 70% or more aligned. Browse overwhelming, strong, and clear democratic mandates across all civic categories.',
  openGraph: {
    title: 'The Civic Mandate · Lobby Market',
    description:
      'Where has the Lobby spoken decisively? Browse every topic with 70%+ consensus — from overwhelming landslides to clear majorities, sorted by strength of mandate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Mandate · Lobby Market',
    description:
      'Every topic with 70%+ consensus on Lobby Market — the voice of the people, measured.',
  },
}

export default function MandatePage() {
  return <MandateClient />
}
