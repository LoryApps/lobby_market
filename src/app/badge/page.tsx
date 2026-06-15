import type { Metadata } from 'next'
import { BadgeClient } from './BadgeClient'

export const metadata: Metadata = {
  title: 'Civic Badge · Lobby Market',
  description:
    'Generate your personal Lobby Market civic badge — a compact stats card you can embed in GitHub READMEs, forum signatures, and social bios.',
  openGraph: {
    title: 'Civic Badge Generator · Lobby Market',
    description:
      'Show off your civic stats anywhere. Generate a shareable badge displaying your votes, arguments, clout, and role.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Badge · Lobby Market',
    description: 'Generate your Lobby Market stats badge for GitHub, forums, and social bios.',
  },
}

export default function BadgePage() {
  return <BadgeClient />
}
