import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const BASE_URL = 'https://lobby.market'

// Static routes with their change frequency and priority
const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'always', priority: 1.0 },
  { url: `${BASE_URL}/archetype`, changeFrequency: 'weekly', priority: 0.88 },
  { url: `${BASE_URL}/quiz`, changeFrequency: 'daily', priority: 0.88 },
  { url: `${BASE_URL}/duel`, changeFrequency: 'always', priority: 0.82 },
  { url: `${BASE_URL}/trending`, changeFrequency: 'hourly', priority: 0.9 },
  { url: `${BASE_URL}/surge`, changeFrequency: 'hourly', priority: 0.85 },
  { url: `${BASE_URL}/hotspot`, changeFrequency: 'always', priority: 0.88 },
  { url: `${BASE_URL}/split`, changeFrequency: 'hourly', priority: 0.85 },
  { url: `${BASE_URL}/momentum`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/law`, changeFrequency: 'daily', priority: 0.85 },
  { url: `${BASE_URL}/law/today`, changeFrequency: 'daily', priority: 0.82 },
  { url: `${BASE_URL}/law/graph`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/law/atlas`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/law/timeline`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/debate`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE_URL}/floor`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/leaderboard/today`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/ladder`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/season`, changeFrequency: 'daily', priority: 0.75 },
  { url: `${BASE_URL}/seasons`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/achievements`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/stats`, changeFrequency: 'hourly', priority: 0.65 },
  { url: `${BASE_URL}/activity-calendar`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/live`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/vote-stream`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/pulse`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/arguments`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/arguments/trending`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/word-cloud`, changeFrequency: 'hourly', priority: 0.7 },
  { url: `${BASE_URL}/arguments/reactions`, changeFrequency: 'hourly', priority: 0.72 },
  { url: `${BASE_URL}/arguments/top-scored`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/arguments/champions`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/arguments/discussions`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/predictions`, changeFrequency: 'hourly', priority: 0.7 },
  { url: `${BASE_URL}/oracle`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/verdicts`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE_URL}/brief`, changeFrequency: 'daily', priority: 0.75 },
  { url: `${BASE_URL}/today`, changeFrequency: 'always', priority: 0.9 },
  { url: `${BASE_URL}/newspaper`, changeFrequency: 'daily', priority: 0.85 },
  { url: `${BASE_URL}/digest`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/topic/categories`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/topic/graph`, changeFrequency: 'daily', priority: 0.65 },
  // Individual category pages
  ...(
    [
      'economics', 'politics', 'technology', 'science',
      'ethics', 'philosophy', 'culture', 'health', 'environment', 'education',
    ].map((slug) => ({
      url: `${BASE_URL}/topic/categories/${slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.65,
    }))
  ),
  { url: `${BASE_URL}/consensus`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/analytics/sentiment`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/analytics/arguments`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/calibration`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/compare`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/compare-users`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/topic/wiki/recent`, changeFrequency: 'hourly', priority: 0.65 },
  { url: `${BASE_URL}/transparency`, changeFrequency: 'hourly', priority: 0.7 },
  { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/widget`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/developers`, changeFrequency: 'monthly', priority: 0.55 },
  { url: `${BASE_URL}/badges`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/help`, changeFrequency: 'monthly', priority: 0.55 },
  { url: `${BASE_URL}/glossary`, changeFrequency: 'monthly', priority: 0.65 },
  { url: `${BASE_URL}/guidelines`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/messages`, changeFrequency: 'always', priority: 0.7 },
  { url: `${BASE_URL}/senate`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/signals`, changeFrequency: 'always', priority: 0.85 },
  { url: `${BASE_URL}/timeline`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/graveyard`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/mindmap`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/spar`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/activity`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/activity/following`, changeFrequency: 'always', priority: 0.65 },
  { url: `${BASE_URL}/city`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/coalitions`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/lobby`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/reactions`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/collections`, changeFrequency: 'daily', priority: 0.6 },
  { url: `${BASE_URL}/almanac`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/arcade`, changeFrequency: 'weekly', priority: 0.75 },
  { url: `${BASE_URL}/polarization`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/changelog`, changeFrequency: 'monthly', priority: 0.55 },
  { url: `${BASE_URL}/missions`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE_URL}/wisdom`, changeFrequency: 'hourly', priority: 0.75 },
  // ── Recently added pages (not previously in sitemap) ────────────────────────────────────────────────────────
  { url: `${BASE_URL}/prompt`, changeFrequency: 'daily', priority: 0.88 },
  { url: `${BASE_URL}/prompt/archive`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/crossroads`, changeFrequency: 'weekly', priority: 0.75 },
  { url: `${BASE_URL}/crossroads/archive`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/elections`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${BASE_URL}/extremes`, changeFrequency: 'hourly', priority: 0.78 },
  { url: `${BASE_URL}/flip`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/influence`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/race`, changeFrequency: 'always', priority: 0.78 },
  { url: `${BASE_URL}/battleground`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/spectrum`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/twins`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/rivals`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/compass`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/lens`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/drift`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/shifts`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/network`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/positions`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/hot-takes`, changeFrequency: 'always', priority: 0.75 },
  { url: `${BASE_URL}/spotlight`, changeFrequency: 'daily', priority: 0.75 },
  { url: `${BASE_URL}/amendments`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/petitions`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/pledges`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/watchdog`, changeFrequency: 'hourly', priority: 0.78 },
  { url: `${BASE_URL}/manifesto`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/capsule`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/journal`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/simulate`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/forecast`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/records`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/radar`, changeFrequency: 'always', priority: 0.78 },
  { url: `${BASE_URL}/agenda`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/dashboard`, changeFrequency: 'hourly', priority: 0.8 },
  { url: `${BASE_URL}/report-card`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/my-week`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/tally`, changeFrequency: 'hourly', priority: 0.7 },
  { url: `${BASE_URL}/verdicts`, changeFrequency: 'hourly', priority: 0.75 },
  { url: `${BASE_URL}/arcade`, changeFrequency: 'weekly', priority: 0.75 },
  { url: `${BASE_URL}/trivia`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/flashcards`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/swipe`, changeFrequency: 'daily', priority: 0.78 },
  { url: `${BASE_URL}/rapid`, changeFrequency: 'daily', priority: 0.75 },
  { url: `${BASE_URL}/crucible`, changeFrequency: 'daily', priority: 0.72 },
  { url: `${BASE_URL}/judge`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/perspective`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/letter`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/weather`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/wrapped`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/milestones`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/skill-tree`, changeFrequency: 'weekly', priority: 0.65 },
  { url: `${BASE_URL}/streaks`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/catchup`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/coalitions/standings`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/coalitions/feed`, changeFrequency: 'always', priority: 0.65 },
  { url: `${BASE_URL}/leaderboard/categories`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/leaderboard/debates`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/leaderboard/laws`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/leaderboard/topics`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/leaderboard/week`, changeFrequency: 'daily', priority: 0.7 },
  { url: `${BASE_URL}/leaderboard/wiki`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/predictions/leaderboard`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/stage`, changeFrequency: 'always', priority: 0.72 },
  { url: `${BASE_URL}/karma`, changeFrequency: 'daily', priority: 0.65 },
  { url: `${BASE_URL}/hotspot`, changeFrequency: 'always', priority: 0.8 },
  { url: `${BASE_URL}/forecasters`, changeFrequency: 'hourly', priority: 0.75 },
  // ── Tag pages (added with tag-sentiment enhancement) ───────────────────────────────────────────────────────────────────
  { url: `${BASE_URL}/tags`, changeFrequency: 'daily', priority: 0.72 },
  // Popular civic tags — static list mirrors migration 00059 civic vocabulary
  ...(
    [
      'climate', 'tax', 'housing', 'healthcare', 'education', 'immigration',
      'economy', 'democracy', 'justice', 'technology', 'privacy', 'energy',
      'welfare', 'trade', 'defense', 'policing', 'infrastructure', 'rights',
      'labor', 'environment', 'regulation', 'freedom', 'equality', 'security',
    ].map((t) => ({
      url: `${BASE_URL}/tags/${encodeURIComponent(t)}`,
      changeFrequency: 'daily' as const,
      priority: 0.65,
    }))
  ),
  // ── Common Threads discovery ─────────────────────────────────────────────────────────────────────────────────────────────────
  { url: `${BASE_URL}/common-threads`, changeFrequency: 'hourly', priority: 0.72 },
  // ── Feeds hub ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { url: `${BASE_URL}/feeds`, changeFrequency: 'monthly', priority: 0.55 },
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

    const topicUrls: MetadataRoute.Sitemap = (topics ?? []).flatMap((topic) => [
      {
        url: `${BASE_URL}/topic/${topic.id}`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: (topic.status === 'law' ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
        priority: topic.status === 'law' ? 0.7 : 0.8,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/versus`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.55,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/evidence`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'hourly' as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/synthesis`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.55,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/quality`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/connections`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/context`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/predictions`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'hourly' as const,
        priority: 0.6,
      },
      {
        url: `${BASE_URL}/topic/${topic.id}/impact`,
        lastModified: new Date(topic.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.55,
      },
    ])

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

    const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).flatMap((p) => ([
      {
        url: `${BASE_URL}/profile/${p.username}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      },
      {
        url: `${BASE_URL}/profile/${p.username}/achievements`,
        lastModified: new Date(p.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.4,
      },
    ]))

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

    // Fetch all distinct tags from topics for dynamic tag pages
    const { data: tagRows } = await supabase
      .from('topics')
      .select('tags, updated_at')
      .not('tags', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500)

    const tagSet = new Map<string, Date>()
    for (const row of tagRows ?? []) {
      const rowTags: string[] = (row as { tags?: string[] }).tags ?? []
      const updatedAt = new Date((row as { updated_at: string }).updated_at)
      for (const t of rowTags) {
        const existing = tagSet.get(t)
        if (!existing || updatedAt > existing) {
          tagSet.set(t, updatedAt)
        }
      }
    }

    const dynamicTagUrls: MetadataRoute.Sitemap = Array.from(tagSet.entries()).map(([t, lastMod]) => ({
      url: `${BASE_URL}/tags/${encodeURIComponent(t)}`,
      lastModified: lastMod,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }))

    return [
      ...STATIC_ROUTES,
      ...topicUrls,
      ...wikiUrls,
      ...lawUrls,
      ...profileUrls,
      ...argumentUrls,
      ...dynamicTagUrls,
    ]
  } catch {
    // If DB is unavailable (e.g. during build), return only static routes
    return STATIC_ROUTES
  }
}
