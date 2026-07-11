import type { Metadata } from 'next'
import { DelegationImpactClient } from './DelegationImpactClient'

export const metadata: Metadata = {
  title: 'Delegation Impact · Lobby Market',
  description:
    'See how Liquid Democracy flows across the platform — platform-wide trust stats, category delegation breakdown, and the most trusted civic delegates.',
  openGraph: {
    title: 'Delegation Impact · Lobby Market',
    description:
      'Liquid Democracy analytics: how voting trust propagates across the Lobby through delegation chains.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Delegation Impact · Lobby Market',
    description: 'Platform trust network stats — delegations given, received, and their civic impact.',
  },
}

export default function DelegationImpactPage() {
  return <DelegationImpactClient />
}
