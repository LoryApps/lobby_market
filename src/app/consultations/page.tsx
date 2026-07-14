import type { Metadata } from 'next'
import { ConsultationsClient } from './ConsultationsClient'

export const metadata: Metadata = {
  title: 'Government Consultations · Lobby Market',
  description:
    'Read and respond to open government consultation documents — Green Papers, White Papers, and calls for evidence shaping civic policy.',
  openGraph: {
    title: 'Government Consultations · Lobby Market',
    description:
      'Your voice in policy-making. Browse open consultations, read proposals, and submit your response before the deadline.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Government Consultations · Lobby Market',
    description: 'Respond to Green Papers, White Papers & calls for evidence.',
  },
}

export default function ConsultationsPage() {
  return <ConsultationsClient />
}
