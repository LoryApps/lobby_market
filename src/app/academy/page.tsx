import type { Metadata } from 'next'
import { AcademyClient } from './AcademyClient'

export const metadata: Metadata = {
  title: 'Civic Academy · Lobby Market',
  description:
    'Learn how democracy works, sharpen your debate skills, and become a more effective civic voice. Four structured courses with practical challenges on the live platform.',
  openGraph: {
    title: 'Civic Academy · Lobby Market',
    description:
      'Four civic courses — Democracy 101, Debate Mastery, Critical Thinking, and Civic Power — with practical challenges on the live Lobby Market platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Academy · Lobby Market',
    description:
      'Master civic engagement through structured courses. Learn, practise, and earn credentials on Lobby Market.',
  },
}

export default function AcademyPage() {
  return <AcademyClient />
}
