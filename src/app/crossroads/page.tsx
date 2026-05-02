import type { Metadata } from 'next'
import { CrossroadsClient } from './CrossroadsClient'

export const metadata: Metadata = {
  title: 'The Civic Crossroads · Lobby Market',
  description:
    'Every week, two fundamental civic values collide. There is no right answer — only your answer. Which value guides your civic soul?',
  openGraph: {
    title: 'The Civic Crossroads · Lobby Market',
    description:
      'A weekly values dilemma: Freedom vs Safety. Equality vs Merit. Progress vs Tradition. Where do you stand?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Crossroads · Lobby Market',
    description:
      'Two values. One choice. Where does your civic compass point? A new dilemma every week.',
  },
}

export default function CrossroadsPage() {
  return <CrossroadsClient />
}
