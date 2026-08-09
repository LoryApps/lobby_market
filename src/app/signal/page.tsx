import type { Metadata } from 'next'
import { SignalClient } from './SignalClient'

export const metadata: Metadata = {
  title: 'Civic Signal · Lobby Market',
  description:
    'The single most urgent civic vote happening right now — algorithmically ranked by threshold proximity, time pressure, and engagement. Your vote matters most here.',
  openGraph: {
    title: 'Civic Signal · Lobby Market',
    description:
      'One debate. Maximum urgency. The vote most likely to be decided by your participation — ranked by how close it is to consensus or defeat.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Signal · Lobby Market',
    description:
      'The debate where your vote matters most right now. Updated every 45 seconds.',
  },
}

export default function SignalPage() {
  return <SignalClient />
}
