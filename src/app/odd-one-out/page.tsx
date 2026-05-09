import type { Metadata } from 'next'
import { OddOneOutClient } from './OddOneOutClient'

export const metadata: Metadata = {
  title: 'Civic Odd One Out · Lobby Market',
  description:
    'Four civic topics — three share a category, one doesn\'t. Find the odd one out. A daily civic categorisation challenge.',
  openGraph: {
    title: 'Civic Odd One Out · Lobby Market',
    description:
      'Can you spot the debate topic that doesn\'t belong? Three topics share a category, one is the odd one out. New puzzle every day.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Odd One Out · Lobby Market',
    description: 'Find the civic topic that doesn\'t fit. A daily category challenge.',
  },
}

export default function OddOneOutPage() {
  return <OddOneOutClient />
}
