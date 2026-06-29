import type { Metadata } from 'next'
import { FactBankClient } from './FactBankClient'

export const metadata: Metadata = {
  title: 'Civic Fact Bank · Lobby Market',
  description:
    'A community-verified database of verifiable civic facts. Submit claims with sources, upvote what you can confirm, and dispute what you can refute. Verified facts power stronger debates.',
  openGraph: {
    title: 'Civic Fact Bank · Lobby Market',
    description:
      'Community-verified civic facts. Submit, verify, and dispute factual claims that shape policy debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Fact Bank · Lobby Market',
    description: 'Community-verified civic facts — the evidence layer of the Lobby.',
  },
}

export default function FactBankPage() {
  return <FactBankClient />
}
