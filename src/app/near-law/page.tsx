import type { Metadata } from 'next'
import { NearLawClient } from './NearLawClient'

export const metadata: Metadata = {
  title: 'Near Law · Lobby Market',
  description:
    'Topics on the brink of becoming law — in final voting with strong majorities. Every vote here could be the one that tips the scale.',
  openGraph: {
    title: 'Near Law · Lobby Market',
    description:
      'The highest-stakes debates on Lobby Market. Topics in final voting with overwhelming support — your vote could write the next law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Near Law · Lobby Market',
    description: 'Debates on the brink of becoming law. Vote now — history is being made.',
  },
}

export default function NearLawPage() {
  return <NearLawClient />
}
