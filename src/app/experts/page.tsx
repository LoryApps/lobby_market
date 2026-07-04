import type { Metadata } from 'next'
import { ExpertsClient } from './ExpertsClient'

export const metadata: Metadata = {
  title: 'Expert Directory · Lobby Market',
  description:
    'Find the most knowledgeable citizens in every civic category — from Economics and Technology to Ethics and Environment. Browse verified experts ranked by accepted answers.',
  openGraph: {
    title: 'Expert Directory · Lobby Market',
    description:
      'Browse the Lobby\'s top Q&A contributors by category. Sages, experts, and contributors who keep the civic conversation informed and evidence-based.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Expert Directory · Lobby Market',
    description: 'Find verified civic experts in every policy category. Ask them your questions.',
  },
}

export default function ExpertsPage() {
  return <ExpertsClient />
}
