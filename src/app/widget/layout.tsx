import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Widget Builder · Lobby Market',
  description:
    'Build and embed live Lobby Market vote widgets on any website. Search for a topic, preview the widget, and copy the iframe code.',
  openGraph: {
    title: 'Widget Builder · Lobby Market',
    description:
      'Embed a live civic vote widget on your website — free, no account needed to display.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Widget Builder · Lobby Market',
    description: 'Embed live Lobby Market vote widgets on any website.',
  },
}

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children
}
