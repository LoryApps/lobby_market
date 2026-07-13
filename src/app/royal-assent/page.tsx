import type { Metadata } from 'next'
import { RoyalAssentClient } from './RoyalAssentClient'

export const metadata: Metadata = {
  title: 'Royal Assent · Lobby Market',
  description:
    'The final ceremony of the Lobby legislative process. Distinguished Elders formally proclaim newly established laws, cementing them in the Civic Codex with the Royal Seal.',
  openGraph: {
    title: 'Royal Assent · Lobby Market',
    description:
      'After the Lords review, Elders grant Royal Assent — the final act that seals a law into the Civic Codex. Browse laws awaiting proclamation and the full register of sealed laws.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Royal Assent · Lobby Market',
    description:
      'The Royal Seal — where distinguished Elders formally proclaim laws into the Civic Codex.',
  },
}

export default function RoyalAssentPage() {
  return <RoyalAssentClient />
}
