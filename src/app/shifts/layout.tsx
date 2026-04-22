import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Opinion Shifts · Lobby Market',
  description:
    'Discover where community opinion is actively moving — topics where recent votes diverge from the historical consensus.',
  openGraph: {
    title: 'Opinion Shifts · Lobby Market',
    description:
      'Track real-time consensus reversals: which topics are suddenly surging For or Against in the past 24 hours?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Opinion Shifts · Lobby Market',
    description:
      'See which debates are experiencing a sudden surge of votes in one direction.',
  },
}

export default function ShiftsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
