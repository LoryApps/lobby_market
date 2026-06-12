import type { Metadata } from 'next'
import { ForgeClient } from './ForgeClient'

export const metadata: Metadata = {
  title: 'The Argument Forge · Lobby Market',
  description:
    'Craft your strongest civic argument. Search for a topic, pick your side, and workshop your case before posting — with live quality feedback to sharpen every word.',
  openGraph: {
    title: 'The Argument Forge · Lobby Market',
    description:
      'A focused writing workspace for civic arguments — draft, refine, and post your case to any debate on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Argument Forge · Lobby Market',
    description:
      'Workshop your civic argument before you post it. Quality feedback, draft saving, and one-click posting.',
  },
}

export default function ForgePage() {
  return <ForgeClient />
}
