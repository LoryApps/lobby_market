import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Civic theme definitions ──────────────────────────────────────────────────

interface ThemeDef {
  id: string
  label: string
  description: string
  color: string
  bg: string
  border: string
  textColor: string
  keywords: string[]
}

const THEMES: ThemeDef[] = [
  {
    id: 'individual_freedom',
    label: 'Individual Freedom',
    description: 'Personal rights, autonomy, and limiting state power',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    textColor: 'text-for-300',
    keywords: ['freedom', 'liberty', 'autonomy', 'rights', 'choice', 'individual', 'personal', 'privacy', 'free'],
  },
  {
    id: 'collective_good',
    label: 'Collective Good',
    description: 'Shared benefits, community welfare, and social cohesion',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    textColor: 'text-emerald',
    keywords: ['collective', 'community', 'society', 'common good', 'public', 'shared', 'together', 'welfare', 'solidarity'],
  },
  {
    id: 'economic_impact',
    label: 'Economic Impact',
    description: 'Financial costs, market forces, and economic consequences',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    textColor: 'text-gold',
    keywords: ['cost', 'economic', 'market', 'money', 'financial', 'price', 'gdp', 'growth', 'jobs', 'tax', 'budget', 'wage'],
  },
  {
    id: 'evidence_data',
    label: 'Evidence & Data',
    description: 'Studies, statistics, and empirical evidence',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    textColor: 'text-purple',
    keywords: ['study', 'research', 'data', 'evidence', 'statistics', 'proven', 'science', 'according to', 'shows', 'demonstrates', 'report'],
  },
  {
    id: 'moral_ethics',
    label: 'Moral & Ethics',
    description: 'Ethical principles, justice, and moral reasoning',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    textColor: 'text-against-300',
    keywords: ['moral', 'ethical', 'justice', 'right', 'wrong', 'fair', 'unfair', 'dignity', 'harm', 'principle', 'value'],
  },
  {
    id: 'government_role',
    label: 'Role of Government',
    description: 'What the state should or should not regulate',
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    textColor: 'text-for-300',
    keywords: ['government', 'regulate', 'policy', 'law', 'state', 'legislation', 'federal', 'mandate', 'authority', 'ban', 'enforce'],
  },
  {
    id: 'future_generations',
    label: 'Future Generations',
    description: 'Long-term consequences and our duty to those who come after',
    color: 'text-emerald',
    bg: 'bg-emerald/5',
    border: 'border-emerald/20',
    textColor: 'text-emerald',
    keywords: ['future', 'generations', 'children', 'long-term', 'legacy', 'sustainable', 'next', 'climate', 'planet', 'inheritance'],
  },
  {
    id: 'inequality',
    label: 'Inequality & Power',
    description: 'Disparities in wealth, power, access, and representation',
    color: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    textColor: 'text-against-400',
    keywords: ['inequality', 'privilege', 'power', 'wealth', 'discrimination', 'access', 'disparity', 'systemic', 'class', 'race', 'minority'],
  },
]

// ─── Response types ────────────────────────────────────────────────────────────

export interface LawThemeArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface LawDebateTheme {
  id: string
  label: string
  description: string
  color: string
  bg: string
  border: string
  textColor: string
  for_count: number
  against_count: number
  total: number
  for_pct: number
  top_for: LawThemeArgument | null
  top_against: LawThemeArgument | null
  arguments: LawThemeArgument[]
}

export interface LawThemesResponse {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string
  topic_id: string
  themes: LawDebateTheme[]
  uncategorized_count: number
  total_arguments: number
  dominant_theme: string | null
  cached_at: string
}

// ─── Keyword classifier ────────────────────────────────────────────────────────

function classifyArgument(content: string): ThemeDef[] {
  const lower = content.toLowerCase()
  return THEMES.filter((theme) =>
    theme.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  )
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch law metadata (includes topic_id)
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch all arguments from the original topic
  const { data: rawArgs, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      profiles!topic_arguments_user_id_fkey(
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', law.topic_id)
    .order('upvotes', { ascending: false })
    .limit(200)

  if (argsErr) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  type RawArg = {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
  }

  const args = (rawArgs ?? []) as unknown as RawArg[]

  // Build theme buckets
  const themeMap = new Map<string, { def: ThemeDef; items: LawThemeArgument[] }>()
  for (const theme of THEMES) {
    themeMap.set(theme.id, { def: theme, items: [] })
  }

  let uncategorizedCount = 0

  for (const arg of args) {
    const matched = classifyArgument(arg.content)
    if (matched.length === 0) {
      uncategorizedCount++
      continue
    }
    const primary = matched[0]
    const bucket = themeMap.get(primary.id)
    if (bucket) {
      bucket.items.push({
        id: arg.id,
        content: arg.content,
        side: arg.side,
        upvotes: arg.upvotes,
        ai_score: arg.ai_score,
        ai_grade: arg.ai_grade,
        created_at: arg.created_at,
        author_username: arg.profiles?.username ?? null,
        author_display_name: arg.profiles?.display_name ?? null,
        author_avatar_url: arg.profiles?.avatar_url ?? null,
      })
    }
  }

  // Shape output — only themes with at least one argument
  const themes: LawDebateTheme[] = []
  for (const [, { def, items }] of themeMap) {
    if (items.length === 0) continue

    const forArgs = items.filter((a) => a.side === 'blue')
    const againstArgs = items.filter((a) => a.side === 'red')
    const total = items.length
    const forPct = total > 0 ? Math.round((forArgs.length / total) * 100) : 50

    themes.push({
      id: def.id,
      label: def.label,
      description: def.description,
      color: def.color,
      bg: def.bg,
      border: def.border,
      textColor: def.textColor,
      for_count: forArgs.length,
      against_count: againstArgs.length,
      total,
      for_pct: forPct,
      top_for: forArgs[0] ?? null,
      top_against: againstArgs[0] ?? null,
      arguments: items.slice(0, 6),
    })
  }

  themes.sort((a, b) => b.total - a.total)

  return NextResponse.json({
    law_id: law.id,
    law_statement: law.statement,
    law_category: law.category ?? null,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    law_established_at: law.established_at,
    topic_id: law.topic_id,
    themes,
    uncategorized_count: uncategorizedCount,
    total_arguments: args.length,
    dominant_theme: themes[0]?.id ?? null,
    cached_at: new Date().toISOString(),
  } satisfies LawThemesResponse)
}
