import type { Metadata } from 'next'
import { SocraticClient } from './SocraticClient'

export const metadata: Metadata = {
  title: 'Socratic Lobby · Lobby Market',
  description:
    'An AI-powered Socratic dialogue that challenges your civic reasoning. Pick a topic, state your position, and let Claude question your assumptions — one probing question at a time.',
  openGraph: {
    title: 'Socratic Lobby · Lobby Market',
    description:
      'Test your civic reasoning in a Socratic dialogue with AI. Five probing questions to examine your assumptions, then a synthesis of what your reasoning reveals.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Socratic Lobby · Lobby Market',
    description:
      'AI-guided Socratic examination of your civic positions. Can your reasoning hold up to five probing questions?',
  },
}

export default function SocraticPage() {
  return <SocraticClient />
}
