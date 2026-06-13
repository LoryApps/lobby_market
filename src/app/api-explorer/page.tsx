import type { Metadata } from 'next'
import { ApiExplorerClient } from './ApiExplorerClient'

export const metadata: Metadata = {
  title: 'API Explorer · Lobby Market',
  description:
    'Interactively explore the Lobby Market v1 REST API — live request builder, response viewer, and cURL snippets for every endpoint.',
  openGraph: {
    title: 'API Explorer · Lobby Market',
    description:
      'Test the Lobby Market public REST API in your browser. Build requests, run them live, and copy the cURL commands.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'API Explorer · Lobby Market',
    description: 'Interactive browser for the Lobby Market v1 REST API.',
  },
}

export default function ApiExplorerPage() {
  return <ApiExplorerClient />
}
