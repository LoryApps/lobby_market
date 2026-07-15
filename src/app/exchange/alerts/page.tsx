import type { Metadata } from 'next'
import { AlertsClient } from './AlertsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Price Alerts · Lobby Exchange',
  description:
    'Set threshold notifications on civic prediction markets — get alerted when a topic\'s consensus price crosses your target level.',
  robots: { index: false },
  openGraph: {
    title: 'Price Alerts · Lobby Exchange',
    description: 'Watch the markets that matter. Set alerts for consensus thresholds on any civic debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

interface Props {
  searchParams: { topic?: string }
}

export default function AlertsPage({ searchParams }: Props) {
  return <AlertsClient prefilledTopicId={searchParams.topic} />
}
