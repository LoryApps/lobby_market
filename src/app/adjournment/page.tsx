import type { Metadata } from 'next'
import { AdjournmentClient } from './AdjournmentClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Adjournment Debates · Lobby Market',
  description:
    'Raise any civic issue for a daily adjournment debate — secured by ballot and support from fellow citizens. The floor is yours.',
  openGraph: {
    title: 'Adjournment Debates · Lobby Market',
    description:
      'Daily end-of-sitting debates on any civic matter. Apply for the floor, gather support, and make your case to the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Adjournment Debates · Lobby Market',
    description: 'Raise any civic issue for a short formal debate. Apply, gather support, and take the floor.',
  },
}

export default function AdjournmentPage() {
  return <AdjournmentClient />
}
