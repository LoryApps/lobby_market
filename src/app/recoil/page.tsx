import type { Metadata } from 'next'
import { RecoilClient } from './RecoilClient'

export const metadata: Metadata = {
  title: 'The Civic Recoil · Lobby Market',
  description:
    'When a civic debate fails to become law, does its defeat inspire a surge of new debate — or does it die silently? The Civic Recoil measures the backlash energy following every failed topic.',
  openGraph: {
    title: 'The Civic Recoil · Lobby Market',
    description:
      'Some debates fail and the community moves on. Others fail and ignite a firestorm. See which failed topics triggered the strongest recoil in their category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Recoil · Lobby Market',
    description: 'Which failed debates sparked a recoil? Measuring civic backlash after defeat.',
  },
}

export default function RecoilPage() {
  return <RecoilClient />
}
