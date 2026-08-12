import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Civic Afterglow · Lobby Market',
  description:
    'Which laws are still burning bright? See the lasting heat of recently-established civic laws — ranked by ongoing debate, views, and community engagement.',
  openGraph: {
    title: 'Civic Afterglow · Lobby Market',
    description:
      'Laws fade from hot to cold. Track which recent laws still glow with active discussion and debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Afterglow · Lobby Market',
    description:
      'The heat map of recently-established laws — which ones still burn bright with community engagement.',
  },
}

export default function AfterglowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
