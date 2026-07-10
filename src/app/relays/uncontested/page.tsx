import type { Metadata } from 'next'
import { UncontestedClient } from './UncontestedClient'

export const metadata: Metadata = {
  title: 'Uncontested Relays · Lobby Market',
  description:
    'Topics where only one side has argued their case in a relay chain. Be the first to make the case for the other side.',
  openGraph: {
    title: 'Uncontested Relays · Lobby Market',
    description:
      'Topics where only one side has argued their case in a relay chain. Be the first to make the case for the other side.',
  },
  twitter: {
    card: 'summary',
    title: 'Uncontested Relays · Lobby Market',
    description:
      'Topics where only one side has argued their case in a relay chain. Be the first to make the case for the other side.',
  },
}

export default function UncontestedPage() {
  return <UncontestedClient />
}
