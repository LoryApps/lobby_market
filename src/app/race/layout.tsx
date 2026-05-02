import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Civic Race · Lobby Market',
  description:
    'Watch which debate topics are surging fastest toward majority consensus or law status. Ranked by vote velocity — updated in real time.',
  openGraph: {
    title: 'Civic Race · Lobby Market',
    description:
      'A live racing chart of active topics competing for democratic consensus. Which debate will reach majority first?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Race · Lobby Market',
    description: 'Live topic velocity rankings — watch democracy race toward consensus.',
  },
}

export default function RaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
