import type { Metadata } from 'next'
import { FrontPageClient } from './FrontPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: "Today's Front Page · Lobby Market",
  description:
    "The Lobby Market daily front page — today's top civic debate, the most compelling argument, and the latest law. Updated every hour.",
  openGraph: {
    title: "Today's Lobby Market Front Page",
    description:
      'The top civic vote, the strongest argument, and the newest law — all on one page.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Today's Lobby Market Front Page",
    description: 'Top civic debate, best argument, and latest law — daily.',
    images: ['/assets/og-share.png'],
  },
}

export default function FrontPage() {
  return <FrontPageClient />
}
