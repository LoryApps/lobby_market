import type { Metadata } from 'next'
import { WorkshopClient } from './WorkshopClient'

export const metadata: Metadata = {
  title: 'Argument Workshop · Lobby Market',
  description:
    'A guided step-by-step argument builder — pick your topic, choose your angle, draft with AI assistance, get quality feedback, then publish directly to the debate.',
  openGraph: {
    title: 'Argument Workshop · Lobby Market',
    description:
      'Build stronger civic arguments in four guided steps: topic, angle, draft, publish.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Workshop · Lobby Market',
    description: 'Guided argument builder — from blank page to published civic argument.',
  },
}

export default function WorkshopPage() {
  return <WorkshopClient />
}
