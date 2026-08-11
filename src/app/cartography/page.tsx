import type { Metadata } from 'next'
import { CartographyClient } from './CartographyClient'

export const metadata: Metadata = {
  title: 'Civic Cartography · Lobby Market',
  description:
    'Map the entire opinion landscape in a single view. Every debate plotted by consensus (For vs Against) and engagement depth — revealing the true geography of civic thought.',
  openGraph: {
    title: 'Civic Cartography · Lobby Market',
    description:
      'Where does the Lobby stand? A scatter plot of every debate — X = For/Against split, Y = engagement depth. Contested territory, settled ground, and the no-man\'s-land in between.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Cartography · Lobby Market',
    description:
      'The full opinion landscape, mapped: consensus vs engagement. See where debates cluster, where territory is settled, and where the front lines are drawn.',
  },
}

export default function CartographyPage() {
  return <CartographyClient />
}
