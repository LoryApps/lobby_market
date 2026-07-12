import type { Metadata } from 'next'
import { ShadowCabinetClient } from './ShadowCabinetClient'

export const metadata: Metadata = {
  title: 'Civic Shadow Cabinet · Lobby Market',
  description:
    'The live ranking of the most credible civic voices in each policy domain — Economics, Technology, Science, Politics, Ethics, and more. Challenge for a seat by voting and arguing in your strongest categories.',
  openGraph: {
    title: 'Civic Shadow Cabinet · Lobby Market',
    description:
      'Who holds the top civic seat in Economics? Technology? Ethics? The Shadow Cabinet ranks the most credible voices in each policy domain — updated in real-time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Shadow Cabinet · Lobby Market',
    description:
      'Live rankings: the top civic voice in each policy domain. Vote, argue, and challenge for your seat.',
  },
}

export default function ShadowCabinetPage() {
  return <ShadowCabinetClient />
}
