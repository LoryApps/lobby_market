import type { Metadata } from 'next'
import { CascadeClient } from './CascadeClient'

export const metadata: Metadata = {
  title: 'The Civic Cascade · Lobby Market',
  description:
    'Which laws ignited a wave of new debate? The Civic Cascade measures the downstream energy surge in vote activity and new topic proposals in the 7 days after each law was established.',
  openGraph: {
    title: 'The Civic Cascade · Lobby Market',
    description:
      'Some laws settle the debate. Others ignite a firestorm. See which established laws triggered an "Ignition" — a 3× surge in category debate activity.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Cascade · Lobby Market',
    description:
      'Which laws sparked more debate than they resolved? The post-law civic energy surge, measured and ranked.',
  },
}

export default function CascadePage() {
  return <CascadeClient />
}
