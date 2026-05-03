import type { Metadata } from 'next'
import { PromptClient } from './PromptClient'

export const metadata: Metadata = {
  title: 'Civic Prompt of the Day · Lobby Market',
  description:
    'One featured civic question every day — vote, share your hot take, and see how the community stands.',
  openGraph: {
    title: 'Civic Prompt of the Day · Lobby Market',
    description:
      'One featured civic question every day — vote, share your hot take, and see how the community stands.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Prompt of the Day · Lobby Market',
    description:
      'One featured civic question every day — vote, share your hot take, and see how the community stands.',
  },
}

export default function PromptPage() {
  return <PromptClient />
}
