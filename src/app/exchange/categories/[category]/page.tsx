import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SectorDetailClient } from './SectorDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Valid categories ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

type ValidCategory = (typeof VALID_CATEGORIES)[number]

function isValidCategory(s: string): s is ValidCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(s)
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface Props {
  params: { category: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = decodeURIComponent(params.category)

  if (!isValidCategory(category)) {
    return { title: 'Sector · Lobby Exchange' }
  }

  const title = `${category} Sector · Lobby Exchange`
  const description =
    `All ${category} prediction markets on Lobby Exchange — live consensus prices, market status, ` +
    `sector trend, laws established, and historical performance.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description: `${category} civic markets: prices, trends, and outcomes on Lobby Exchange.`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SectorDetailPage({ params }: Props) {
  const category = decodeURIComponent(params.category)

  if (!isValidCategory(category)) {
    notFound()
  }

  return <SectorDetailClient category={category} />
}
