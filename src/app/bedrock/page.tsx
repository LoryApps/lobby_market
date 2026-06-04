import type { Metadata } from 'next'
import { BedrockClient } from './BedrockClient'

export const metadata: Metadata = {
  title: 'The Civic Bedrock · Lobby Market',
  description:
    'The most durable, democratically-legitimate laws on Lobby Market — ranked by age, consensus strength, and vote weight. These are the foundations the platform\'s civic code is built on.',
  openGraph: {
    title: 'The Civic Bedrock · Lobby Market',
    description:
      'Not all laws are created equal. The Bedrock reveals which established laws have held the strongest democratic consensus for the longest time — the constitutional pillars every citizen stands on.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Bedrock · Lobby Market',
    description:
      'Laws ranked by democratic permanence — the oldest, most consensus-backed pillars of civic code.',
  },
}

export default function BedrockPage() {
  return <BedrockClient />
}
