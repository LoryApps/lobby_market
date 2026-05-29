import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ExpertsClient } from './ExpertsClient'

const CANONICAL_CATEGORIES: Record<string, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

const CATEGORY_DESCRIPTION: Record<string, string> = {
  Economics: 'markets, trade, fiscal policy, and economic systems',
  Politics: 'governance, elections, parties, and political theory',
  Technology: 'AI, digital rights, innovation, and tech regulation',
  Science: 'research, climate, biology, physics, and evidence-based policy',
  Ethics: 'moral philosophy, bioethics, justice, and values',
  Philosophy: 'epistemology, metaphysics, and the foundations of thought',
  Culture: 'arts, identity, society, and cultural norms',
  Health: 'medicine, mental health, public health, and healthcare systems',
  Environment: 'ecology, sustainability, climate change, and conservation',
  Education: 'schooling, higher education, learning, and curricula',
}

interface Props {
  params: { category: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const canonical = CANONICAL_CATEGORIES[params.category.toLowerCase()]
  if (!canonical) return { title: 'Category Experts · Lobby Market' }

  const title = `Top ${canonical} Voices · Lobby Market`
  const description =
    `Discover the most influential contributors in ${canonical} debates on Lobby Market — ` +
    `ranked by argument quality, community upvotes, and civic impact across topics covering ${CATEGORY_DESCRIPTION[canonical] ?? canonical.toLowerCase()}.`

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
      description,
    },
  }
}

export default function CategoryExpertsPage({ params }: Props) {
  const canonical = CANONICAL_CATEGORIES[params.category.toLowerCase()]
  if (!canonical) notFound()
  return <ExpertsClient category={canonical} slug={params.category.toLowerCase()} />
}
