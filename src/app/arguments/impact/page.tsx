import { Metadata } from 'next'
import ImpactClient from './ImpactClient'

export const metadata: Metadata = {
  title: 'My Argument Impact | Lobby Market',
  description:
    'Track the civic impact of your arguments — laws enacted, upvote reach, and your overall influence on the platform.',
}

export default function ArgumentImpactPage() {
  return <ImpactClient />
}
