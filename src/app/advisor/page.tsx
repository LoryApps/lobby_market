import type { Metadata } from 'next'
import { AdvisorClient } from './AdvisorClient'

export const metadata: Metadata = {
  title: 'Civic Advisor · Lobby Market',
  description:
    'Your AI-powered civic briefing — personalised topic recommendations based on your voting history, expertise, and what the platform needs most right now.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Advisor · Lobby Market',
    description: 'Get personalised AI recommendations on which civic debates to engage with today.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Advisor · Lobby Market',
    description: 'Personalised AI civic briefing — which debates need your voice most right now.',
  },
}

export default function AdvisorPage() {
  return <AdvisorClient />
}
