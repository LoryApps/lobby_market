import type { Metadata } from 'next'
import { FrictionClient } from './FrictionClient'

export const metadata: Metadata = {
  title: 'Civic Friction Index · Lobby Market',
  description:
    'Which civic debates refuse to resolve? Track the stickiest controversies — topics with high engagement, long lifespans, and no consensus in sight. The immovable objects of democratic discourse.',
  openGraph: {
    title: 'Civic Friction Index · Lobby Market',
    description:
      'In physics, friction resists motion. In civic debate, it keeps controversies locked in place — many votes, years of argument, no resolution. Here are the debates that won\'t budge.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Friction Index · Lobby Market',
    description:
      'The civic debates that refuse to resolve — high friction, high engagement, zero consensus. Which controversies are stuck?',
  },
}

export default function FrictionPage() {
  return <FrictionClient />
}
