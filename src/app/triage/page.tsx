import type { Metadata } from 'next'
import { TriageClient } from './TriageClient'

export const metadata: Metadata = {
  title: 'Civic Triage · Lobby Market',
  description:
    'Where is your vote most needed? Civic Triage ranks every active debate by urgency — topics near the consensus threshold, deadlocked 50/50 fights, neglected proposals, and votes expiring soon.',
  openGraph: {
    title: 'Civic Triage · Lobby Market',
    description:
      'Your vote matters most where the margin is thinnest. Find the debates closest to becoming law — or closest to failing — and cast the decisive vote.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Triage · Lobby Market',
    description:
      'Near the line. Deadlocked. Neglected. Expiring. Four urgency tiers — one question: where does your vote matter most?',
  },
}

export default function TriagePage() {
  return <TriageClient />
}
