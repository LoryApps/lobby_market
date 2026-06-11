import type { Metadata } from 'next'
import { ValuesClient } from './ValuesClient'

export const metadata: Metadata = {
  title: 'Civic Values · Lobby Market',
  description:
    'What does this community believe? AI-powered analysis of all democratically-established laws surfaces the underlying civic values the community\'s collective decisions express.',
  openGraph: {
    title: 'Civic Values · Lobby Market',
    description:
      'The values hidden in democratic outcomes — AI analyzes every established law to reveal the civic principles this community actually holds.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Values · Lobby Market',
    description:
      'What does the community believe? Values inferred from every law the Lobby has democratically established.',
  },
}

export default function ValuesPage() {
  return <ValuesClient />
}
