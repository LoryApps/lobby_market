import type { Metadata } from 'next'
import { BillsClient } from './BillsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Bills · Lobby Market',
  description:
    'Bills before the Civic Parliament — track each bill through First Reading, Second Reading, Committee Stage, Lords, and Royal Assent.',
  openGraph: {
    title: 'Civic Bills · Lobby Market',
    description:
      'Follow legislation through its parliamentary journey. Vote at each reading, propose amendments, and watch bills become law — or fall.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Bills · Lobby Market',
    description:
      'Bills before Parliament. Vote at Second and Third Reading, track amendments, and witness Royal Assent.',
  },
}

export default function BillsPage() {
  return <BillsClient />
}
