import type { Metadata } from 'next'
import { ByExpertClient } from './ByExpertClient'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = params.username
  return {
    title: `${username}'s Q&A Answers · Lobby Market`,
    description: `Browse all Q&A answers from ${username} — accepted answers, expertise tiers, and contributions across civic debate categories.`,
    openGraph: {
      title: `${username}'s Q&A Contributions · Lobby Market`,
      description: `See every answer ${username} has contributed to the Lobby Q&A — across topics, categories, and debates.`,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${username}'s Q&A Answers · Lobby Market`,
      description: `Q&A contributions from ${username} across Lobby Market civic debates.`,
    },
  }
}

export default function ByExpertPage({ params }: Props) {
  return <ByExpertClient username={params.username} />
}
