import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const BASE_URL = 'https://lobby.market'

// Static routes with their change frequency and priority
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'always', priority: 1.0 },
  { url: `${BASE_URL}/quiz`, changeFrequency: 'daily', priority: 0.88 },
  { url: `${BASE_URL}/duel`, changeFrequency: 'always', priority: 0.82 },
  { url: `${BASE_URL}/trending`, changeFrequency: 'hourly', priority: 0.9 },
  { url: `${BASE_URL}/surge`, changeFrequency: 'hourly', priority: 0.85 },
  { url: `${BASE_URL}/split`, changeFrequency: 'hourly', priority: 0.85 },
  { url: `${BASE_URL}/momentum`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/law`, changeFrequency: 'daily', priority: 0.85 },
  { url: `${BASE_URL}/law/graph`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/law/atlas`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/law/timeline`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/debate`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE_URL}/floor`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/achievements`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/stats`, changeFrequency: 'hourly', priority: 0.65 },
  { url: `${BASE_URL}/live`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/pulse`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/arguments`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/predictions`, changeFrequency: 'hourly', priority: 0.7 },
  { url: `${BASE_URL}/verdicts`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE_URL}/brief`, changeFrequency: 'daily', priority: 0.75 },
  { url: `${BASE_URL}/digest`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/topic/categories`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/topic/graph`, changeFrequency: 'daily', priority: 0.65 },
  // Individual category pages
  ...([
    'economics', 'politics', 'technology', 'science',
    'ethics', 'philosophy', 'culture', 'health', 'environment', 'education',
  ].map((slug) => ({
    url: `${BASE_URL}/topic/categories/${slug}`,
    changeFrequency: 'daily' as const,
    priority: 0.65,
  }))),
  { url: `${BASE_URL}/compare`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/compare-users`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/topic/wiki/recent`, changeFrequency: 'hourly', priority: 0.65 },
  { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/widget`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/developers`, changeFrequency: 'monthly', priority: 0.55 },
  { url: `${BASE_URL}/help`, changeFrequency: 'monthly', priority: 0.55 },
  { url: `${BASE_URL}/guidelines`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/senate`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/signals`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/activity`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/city`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/coalitions`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/lobby`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/reactions`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/collections`, changeFrequency: 'daily', priority: 0.6 },
]

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const supabase = await createClient()

    // Fetch public topics (active, voting, law) — limit to 1000 most recent
    const { data: topics } = await supabase
      .from('topics')
      .select('id, updated_at, status')
      .in('status', ['active', 'voting', 'law'])
      .order('updated_at', { ascending: false })
      .limit(1000)

    const topicUrls: MetadataRoute.Sitemap = (topics ?? []).map((topic) => ({
      url: `${BASE_URL}/topic/${topic.id}`,
      lastModified: new Date(topic.updated_at),
      changeFrequency: topic.status === 'law' ? 'monthly' : 'hourly',
      priority: topic.status === 'law' ? 0.7 : 0.8,
    }))

    // Wiki pages for topics that have descriptions
    const { data: topicsWithWiki } = await supabase
      .from('topics')
      .select('id, description_updated_at, updated_at')
      .not('description', 'is', null)
      .order('description_updated_at', { ascending: false })
      .limit(500)

    const wikiUrls: MetadataRoute.Sitemap = (topicsWithWiki ?? []).map((t) => ({
      url: `${BASE_URL}/topic/wiki/${t.id}`,
      lastModified: new Date(t.description_updated_at ?? t.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.55,
    }))

    // Fetch all established laws — these are canonical, stable pages
    const { data: laws } = await supabase
      .from('laws')
      .select('id, established_at')
      .order('established_at', { ascending: false })
      .limit(2000)

    const lawUrls: MetadataRoute.Sitemap = (laws ?? []).map((law) => ({
      url: `${BASE_URL}/law/${law.id}`,
      lastModified: new Date(law.established_at),
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    }))

    // Fetch public user profiles (only those with a username)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, updated_at')
      .not('username', 'is', null)
      .order('reputation_score', { ascending: false })
      .limit(500)

    const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
      url: `${BASE_URL}/profile/${p.username}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

    // Fetch top arguments (most upvoted) for permalink pages
    const { data: topArguments } = await supabase
      .from('topic_arguments')
      .select('id, created_at')
      .order('upvotes', { ascending: false })
      .limit(500)

    const argumentUrls: MetadataRoute.Sitemap = (topArguments ?? []).map((a) => ({
      url: `${BASE_URL}/arguments/${a.id}`,
      lastModified: new Date(a.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.45,
    }))

    return [...STATIC_ROUTES, ...topicUrls, ...wikiUrls, ...lawUrls, ...profileUrls, ...argumentUrls]
  } catch {
    // If DB is unavailable (e.g. during build), return only static routes
    return STATIC_ROUTES
  }
}
