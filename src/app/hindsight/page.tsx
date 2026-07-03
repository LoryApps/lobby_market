import type { Metadata } from 'next'
import { HindsightDashboardClient } from './HindsightDashboardClient'

export const metadata: Metadata = {
  title: 'Community Hindsight · Lobby Market',
  description:
    'Did we make the right calls? Platform-wide retrospective analysis of resolved civic debates — see which laws the community celebrates and which they regret.',
  openGraph: {
    title: 'Community Hindsight · Lobby Market',
    description:
      'Collective wisdom in review: after topics resolve, citizens reflect on whether the right call was made. See the most regretted and vindicated civic decisions.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Community Hindsight · Lobby Market',
    description: 'Were we right? Platform-wide retrospective on resolved civic debates.',
  },
}

export default function HindsightDashboardPage() {
  return <HindsightDashboardClient />
}
