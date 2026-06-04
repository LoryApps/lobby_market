import type { Metadata } from 'next'
import { PivotClient } from './PivotClient'

export const metadata: Metadata = {
  title: 'The Civic Pivot · Lobby Market',
  description:
    'Topics where recent community opinion has significantly diverged from the historical consensus — debates the platform is quietly reconsidering. Ranked by swing magnitude.',
  openGraph: {
    title: 'The Civic Pivot · Lobby Market',
    description:
      'Not every reversal is loud. The Pivot surfaces the debates where recent voters are quietly disagreeing with the established consensus — the issues the community is slowly changing its mind about.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Pivot · Lobby Market',
    description:
      'Debates where the recent community disagrees with the historical consensus — opinion reversals in progress.',
  },
}

export default function PivotPage() {
  return <PivotClient />
}
