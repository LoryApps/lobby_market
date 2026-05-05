import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seasons Hall of Fame · Lobby Market',
  description:
    'Every civic season, every champion — the all-time record of Lobby Market\'s monthly championships. See who shaped history in each era.',
  openGraph: {
    title: 'Seasons Hall of Fame · Lobby Market',
    description:
      'The all-time record of Lobby Market civic seasons. Champions, podiums, and the citizens who shaped each era.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seasons Hall of Fame · Lobby Market',
    description: 'Every season champion, every era — the full history of civic competition on Lobby Market.',
  },
}

export default function SeasonsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
