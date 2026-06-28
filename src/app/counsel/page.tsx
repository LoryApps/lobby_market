import type { Metadata } from 'next'
import { CounselClient } from './CounselClient'

export const metadata: Metadata = {
  title: 'The Civic Counsel · Lobby Market',
  description:
    'Ask the Civic Counsel anything about ongoing debates, established laws, and the state of community consensus on Lobby Market. AI-powered civic intelligence, grounded in real platform data.',
  openGraph: {
    title: 'The Civic Counsel · Lobby Market',
    description:
      'Your AI guide to civic debate — ask about topics, laws, arguments, and community positions. Real platform data, balanced perspectives.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Counsel · Lobby Market',
    description:
      'Ask the Lobby\'s AI assistant about any civic debate, law, or community position. Powered by real platform data.',
  },
}

export default function CounselPage() {
  return <CounselClient />
}
