import type { Metadata } from 'next'
import { TenMinuteRuleClient } from './TenMinuteRuleClient'

export const metadata: Metadata = {
  title: 'Ten Minute Rule · Lobby Market',
  description:
    'Propose new legislation through the Ten Minute Rule — submit a short speech, find an opponent, and let the House decide whether your bill should be introduced.',
  openGraph: {
    title: 'Ten Minute Rule · Lobby Market',
    description:
      'The parliamentary procedure that lets any citizen introduce a bill. Propose, debate, and let the House vote on whether to introduce your legislation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Ten Minute Rule · Lobby Market',
    description:
      'Any citizen can propose a bill through the Ten Minute Rule. Make your pitch, find an opponent, and let the House vote.',
  },
}

export default function TenMinuteRulePage() {
  return <TenMinuteRuleClient />
}
