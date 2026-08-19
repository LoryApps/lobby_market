import type { Metadata } from 'next'
import { ThesisOfTheDayClient } from './ThesisOfTheDayClient'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'
const OG_IMAGE = `${BASE_URL}/api/og/thesis/today`

export const metadata: Metadata = {
  title: 'Thesis of the Day · Lobby Market',
  description:
    'Every day, one civic thesis rises to the top. The most contested, most engaged prediction on the platform — do you agree or disagree?',
  openGraph: {
    title: 'Thesis of the Day · Lobby Market',
    description:
      'One civic prediction is spotlighted daily — the most contested thesis on the Lobby. Cast your verdict.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Thesis of the Day' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thesis of the Day · Lobby Market',
    description:
      'The most contested civic prediction on the Lobby today. Do you agree or disagree?',
    images: [OG_IMAGE],
  },
}

export default function ThesisOfTheDayPage() {
  return <ThesisOfTheDayClient />
}
