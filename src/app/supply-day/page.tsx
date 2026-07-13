import type { Metadata } from 'next'
import { SupplyDayClient } from './SupplyDayClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Supply Day · Lobby Market',
  description:
    'Opposition coalitions table formal motions for debate, urgent questions, censures, and divisions. Sign motions you support and hold the government to account.',
  openGraph: {
    title: 'Supply Day · Lobby Market',
    description:
      'The parliamentary mechanism where opposition coalitions set the agenda. Table motions, rally endorsements, and force the government to respond.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Supply Day · Lobby Market',
    description:
      'Opposition Day debates — table formal motions, rally civic support, and hold the governing coalition to account.',
  },
}

export default function SupplyDayPage() {
  return <SupplyDayClient />
}
