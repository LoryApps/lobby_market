import type { Metadata } from 'next'
import { ArcsClient } from './ArcsClient'

export const metadata: Metadata = {
  title: 'Civic Arcs · Lobby Market',
  description:
    'Every resolved debate has a story. Civic Arcs traces the full opinion arc of topics that became law or failed — from first vote to final verdict, day by day.',
  openGraph: {
    title: 'Civic Arcs · Lobby Market',
    description:
      'See how public opinion shifted on resolved debates. Each arc is the complete journey from first vote to final outcome.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Arcs · Lobby Market',
    description: 'The opinion journey of resolved civic debates — day by day, vote by vote.',
  },
}

export default function ArcsPage() {
  return <ArcsClient />
}
