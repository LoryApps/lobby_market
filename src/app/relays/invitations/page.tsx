import type { Metadata } from 'next'
import { RelayInvitationsClient } from './RelayInvitationsClient'

export const metadata: Metadata = {
  title: 'Relay Invitations · Lobby Market',
  description:
    'Manage your relay chain invitations — accept or decline invitations to join an argument relay, and track invitations you\'ve sent to other citizens.',
  robots: { index: false },
}

export default function RelayInvitationsPage() {
  return <RelayInvitationsClient />
}
