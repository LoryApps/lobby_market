import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Surge · Lobby Market',
  description:
    'Topics hitting critical mass right now — about to activate, in final voting hours, or gaining rapid momentum. Your vote matters most here.',
  openGraph: {
    title: 'Surge · Lobby Market',
    description: 'Where the Lobby needs your voice most right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Surge · Lobby Market',
    description: 'Topics gaining critical momentum — vote now.',
  },
}

export default function SurgeLayout({ children }: { children: ReactNode }) {
  return children
}
