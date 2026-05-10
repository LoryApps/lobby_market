import type { Metadata } from 'next'
import { TopArgumentsClient } from './TopArgumentsClient'

export const metadata: Metadata = {
  title: 'Top Arguments · Lobby Market',
  description:
    'The highest-quality civic arguments on Lobby Market — AI-graded for clarity, evidence, logic, and persuasion. From A-grade masterclasses to work in progress.',
  openGraph: {
    title: 'Top Arguments · Lobby Market',
    description:
      'AI-graded arguments ranked by quality and community upvotes. The best reasoning on the platform, all in one place.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Top Arguments · Lobby Market',
    description: 'The highest-quality civic arguments, graded by AI and ranked by upvotes.',
  },
}

export default function TopArgumentsPage() {
  return <TopArgumentsClient />
}
