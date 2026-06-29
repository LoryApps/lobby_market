import type { Metadata } from 'next'
import { OmbudsmanClient } from './OmbudsmanClient'

export const metadata: Metadata = {
  title: 'Civic Ombudsman · Lobby Market',
  description:
    'The independent civic oversight authority of Lobby Market. File formal complaints about process fairness, decision appeals, and civic integrity. All cases are public. All findings are binding on record.',
  openGraph: {
    title: 'Civic Ombudsman · Lobby Market',
    description:
      'The Lobby\'s independent accountability authority. Raise formal cases on process fairness, contested decisions, and civic norm breaches. Public findings. Transparent process.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Ombudsman · Lobby Market',
    description:
      'Formal civic complaints, independent review, and public findings. The accountability layer of Lobby Market democracy.',
  },
}

export default function OmbudsmanPage() {
  return <OmbudsmanClient />
}
