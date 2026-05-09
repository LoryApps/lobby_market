import type { Metadata } from 'next'
import { CivicDecoderClient } from './CivicDecoderClient'

export const metadata: Metadata = {
  title: 'Civic Decoder · Lobby Market',
  description:
    'Three real arguments. One mystery topic. Five rounds. Can you decode which topic these arguments came from? A daily argument-recognition challenge.',
  openGraph: {
    title: 'Civic Decoder · Lobby Market',
    description:
      'Read three real arguments, then identify which civic topic they came from. A daily puzzle that tests your civic intuition.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Decoder · Lobby Market',
    description: 'Three arguments. One topic. Can you crack the code? Daily civic puzzle.',
  },
}

export default function CivicDecoderPage() {
  return <CivicDecoderClient />
}
