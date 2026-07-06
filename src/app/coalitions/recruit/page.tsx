import type { Metadata } from 'next'
import { RecruitClient } from './RecruitClient'

export const metadata: Metadata = {
  title: 'Coalition Recruiting · Lobby Market',
  description:
    'Find your political alliance. Browse coalitions actively seeking new members, see their mission and stances, and join instantly or request access.',
  openGraph: {
    title: 'Coalition Recruiting · Lobby Market',
    description: 'Find the right civic alliance for your political views.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Coalition Recruiting · Lobby Market',
    description: 'Find your political alliance on Lobby Market.',
  },
}

export default function CoalitionRecruitPage() {
  return <RecruitClient />
}
