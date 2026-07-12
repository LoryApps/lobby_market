import type { Metadata } from 'next'
import { ReportsClient } from './ReportsClient'

export const metadata: Metadata = {
  title: 'Committee Reports · Lobby Market',
  description:
    'Formal findings and policy recommendations from civic committee investigations. Citizens publish structured reports after hearings — endorsed by the community, filed in the permanent record.',
  openGraph: {
    title: 'Committee Reports · Lobby Market',
    description:
      'Formal civic reports with policy findings and recommendations — the permanent record of committee investigations.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Committee Reports · Lobby Market',
    description: 'Formal civic committee findings, analysis, and policy recommendations.',
  },
}

export default function ReportsPage() {
  return <ReportsClient />
}
