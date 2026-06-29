import { Metadata } from 'next'
import IntegrityClient from './IntegrityClient'

export const metadata: Metadata = {
  title: 'Civic Integrity Monitor | Lobby Market',
  description:
    'Platform health metrics, vote-pattern analysis, and coordinated-activity signals for transparent civic governance.',
}

export default function IntegrityPage() {
  return <IntegrityClient />
}
