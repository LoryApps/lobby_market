import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SeasonClient } from './SeasonClient'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const { data: season } = await supabase
    .from('civic_seasons')
    .select('name, slug, tagline, ends_at, is_active')
    .eq('is_active', true)
    .maybeSingle()

  const title = season ? `${season.name} · Lobby Market` : 'Civic Season · Lobby Market'
  const description = season?.tagline ??
    'Monthly competitive seasons — earn Season Points for every vote, argument, and law you help pass. Top citizens win exclusive seasonal titles.'

  const ogImage = season
    ? `${BASE_URL}/api/og/season/${season.slug}`
    : `${BASE_URL}/assets/og-share.png`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default function SeasonPage() {
  return <SeasonClient />
}
