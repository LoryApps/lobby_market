import type { Metadata } from 'next'
import { IntroduceClient } from './IntroduceClient'

export const metadata: Metadata = {
  title: 'Introduce a Bill · Lobby Market',
  description:
    'Formally introduce a new civic bill to Parliament. Set the title, category, and bill type — your bill enters at First Reading and progresses through the full legislative journey.',
  openGraph: {
    title: 'Introduce a Bill · Lobby Market',
    description:
      'Bring a new bill to the Civic Parliament. From First Reading to Royal Assent — your legislation, shaped by the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function IntroduceBillPage() {
  return <IntroduceClient />
}
