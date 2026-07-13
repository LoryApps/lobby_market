import type { Metadata } from 'next'
import { BudgetClient } from './BudgetClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'The Civic Budget · Lobby Market',
  description:
    'The governing coalition\'s annual civic budget — category allocations, spending priorities, and the parliamentary vote that determines its fate.',
  openGraph: {
    title: 'The Civic Budget · Lobby Market',
    description:
      'Annual resource allocation across the 10 civic categories. Proposed by the government, debated in parliament, approved or rejected by the people.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Civic Budget · Lobby Market',
    description: 'Annual civic spending plan — vote to approve or reject.',
  },
}

export default function BudgetPage() {
  return <BudgetClient />
}
