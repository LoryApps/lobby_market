import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Senate · Lobby Market',
  description:
    'Topics in their final voting phase — every vote counts before the deadline. Vote now to shape what becomes law.',
  openGraph: {
    title: 'The Senate · Lobby Market',
    description: 'Final votes are being cast. These topics close soon — your vote determines what becomes law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Senate · Lobby Market',
    description: 'Cast your final votes. Topics in their last hours before closing.',
  },
}

export default function SenateLayout({ children }: { children: React.ReactNode }) {
  return children
}
