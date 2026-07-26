import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrativeTheme {
  key: string
  label: string
  description: string
  strength: number        // 0–100
  argument_count: number
  top_argument: string | null
  top_upvotes: number
}

export interface NarrativeSide {
  side: 'for' | 'against'
  total_arguments: number
  total_upvotes: number
  avg_upvotes: number
  themes: NarrativeTheme[]
  dominant_theme: string | null
  momentum_score: number  // recent (7d) upvotes / total upvotes, 0–100
  recent_argument_count: number
}

export interface NarrativeBalance {
  for_strength: number      // 0–100
  against_strength: number  // 0–100
  contested: boolean        // within 10 points
  leading_side: 'for' | 'against' | 'balanced'
  core_tension: string      // the fundamental disagreement framing
}

export interface NarrativeData {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  total_votes: number
  for_side: NarrativeSide
  against_side: NarrativeSide
  balance: NarrativeBalance
  total_arguments: number
  analysis_note: string
}

// ─── Theme classifier ─────────────────────────────────────────────────────────

const THEMES: { key: string; label: string; description: string; keywords: string[] }[] = [
  {
    key: 'economic',
    label: 'Economic',
    description: 'Arguments grounded in costs, benefits, markets, and financial impact',
    keywords: [
      'cost', 'money', 'economic', 'economy', 'market', 'tax', 'growth', 'jobs',
      'income', 'wealth', 'spend', 'afford', 'expensive', 'budget', 'fund', 'invest',
      'price', 'wage', 'profit', 'loss', 'gdp', 'inflation', 'trade', 'resource',
    ],
  },
  {
    key: 'rights',
    label: 'Rights & Liberty',
    description: 'Arguments centered on individual rights, freedoms, and autonomy',
    keywords: [
      'right', 'freedom', 'liberty', 'choice', 'individual', 'autonomy', 'privacy',
      'consent', 'free', 'personal', 'control', 'self', 'independent', 'voluntary',
      'force', 'compel', 'mandate', 'coerce', 'restrict', 'ban', 'prohibit',
    ],
  },
  {
    key: 'evidence',
    label: 'Evidence & Data',
    description: 'Arguments backed by research, statistics, science, or empirical facts',
    keywords: [
      'data', 'research', 'study', 'evidence', 'proven', 'science', 'statistic',
      'fact', 'show', 'find', 'result', 'report', 'survey', 'experiment', 'analysis',
      'percent', 'number', 'rate', 'measure', 'trial', 'expert', 'academic', 'peer',
    ],
  },
  {
    key: 'ethics',
    label: 'Ethics & Morality',
    description: 'Arguments appealing to moral principles, justice, or values',
    keywords: [
      'moral', 'ethical', 'justice', 'fair', 'value', 'principle', 'wrong', 'harm',
      'responsibility', 'duty', 'obligation', 'corrupt', 'honest', 'dignity', 'humane',
      'cruel', 'unjust', 'discrimination', 'equality', 'human', 'rights', 'virtue',
    ],
  },
  {
    key: 'practical',
    label: 'Practical',
    description: 'Arguments about implementation, effectiveness, and real-world workability',
    keywords: [
      'practical', 'implement', 'work', 'effective', 'solution', 'realistic', 'simple',
      'complex', 'difficult', 'feasible', 'enforce', 'apply', 'manage', 'operate',
      'outcome', 'consequence', 'unintended', 'loophole', 'abuse', 'failure', 'success',
    ],
  },
  {
    key: 'social',
    label: 'Social & Community',
    description: 'Arguments about social cohesion, community welfare, and collective good',
    keywords: [
      'society', 'community', 'people', 'public', 'social', 'common', 'together',
      'culture', 'norm', 'trust', 'cohesion', 'divide', 'unity', 'solidarity',
      'vulnerable', 'protect', 'support', 'care', 'wellbeing', 'health', 'safety',
    ],
  },
  {
    key: 'future',
    label: 'Future & Innovation',
    description: 'Arguments about long-term consequences, innovation, and progress',
    keywords: [
      'future', 'innovation', 'technology', 'progress', 'develop', 'advance',
      'modern', 'change', 'next', 'generation', 'long-term', 'sustainable',
      'climate', 'environment', 'transform', 'disrupt', 'lead', 'opportunity',
    ],
  },
  {
    key: 'precedent',
    label: 'Precedent & History',
    description: 'Arguments drawing on historical examples, traditions, or past outcomes',
    keywords: [
      'history', 'historical', 'tradition', 'precedent', 'past', 'before', 'already',
      'proven', 'established', 'classic', 'original', 'founding', 'legacy', 'heritage',
      'tried', 'tested', 'example', 'case', 'instance', 'similar', 'comparable',
    ],
  },
]

function classifyThemes(content: string): string[] {
  const lower = content.toLowerCase()
  const matched: string[] = []
  for (const theme of THEMES) {
    const hits = theme.keywords.filter((kw) => lower.includes(kw)).length
    if (hits >= 2 || (hits === 1 && lower.split(' ').length < 30)) {
      matched.push(theme.key)
    }
  }
  // Always return at least one theme based on highest keyword density
  if (matched.length === 0) {
    let best = { key: 'practical', count: 0 }
    for (const theme of THEMES) {
      const count = theme.keywords.filter((kw) => lower.includes(kw)).length
      if (count > best.count) best = { key: theme.key, count }
    }
    matched.push(best.key)
  }
  return matched
}

function computeThemes(
  args: { content: string; upvotes: number; created_at: string }[]
): NarrativeTheme[] {
  const themeMap: Map<string, { upvotes: number; args: string[]; max_upvotes: number; top_arg: string | null }> = new Map()

  for (const arg of args) {
    const matched = classifyThemes(arg.content)
    for (const key of matched) {
      const existing = themeMap.get(key) ?? { upvotes: 0, args: [], max_upvotes: 0, top_arg: null }
      existing.upvotes += arg.upvotes
      existing.args.push(arg.content)
      if (arg.upvotes > existing.max_upvotes) {
        existing.max_upvotes = arg.upvotes
        existing.top_arg = arg.content
      }
      themeMap.set(key, existing)
    }
  }

  const maxUpvotes = Math.max(1, ...Array.from(themeMap.values()).map((v) => v.upvotes))

  return THEMES
    .filter((t) => themeMap.has(t.key))
    .map((t) => {
      const data = themeMap.get(t.key)!
      return {
        key: t.key,
        label: t.label,
        description: t.description,
        strength: Math.round((data.upvotes / maxUpvotes) * 100),
        argument_count: data.args.length,
        top_argument: data.top_arg,
        top_upvotes: data.max_upvotes,
      }
    })
    .sort((a, b) => b.strength - a.strength)
}

function computeMomentum(
  args: { upvotes: number; created_at: string }[]
): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentUpvotes = args
    .filter((a) => new Date(a.created_at).getTime() >= cutoff)
    .reduce((sum, a) => sum + a.upvotes, 0)
  const totalUpvotes = args.reduce((sum, a) => sum + a.upvotes, 0)
  if (totalUpvotes === 0) return 0
  return Math.round((recentUpvotes / totalUpvotes) * 100)
}

function deriveTension(
  category: string | null,
  forThemes: NarrativeTheme[],
  againstThemes: NarrativeTheme[],
): string {
  const topFor = forThemes[0]?.key
  const topAgainst = againstThemes[0]?.key

  const tensions: Record<string, Record<string, string>> = {
    economic: {
      rights: 'Market efficiency vs. individual liberty',
      ethics: 'Economic benefit vs. moral cost',
      social: 'Growth vs. social equity',
      practical: 'Economic theory vs. real-world implementation',
      evidence: 'Economic models vs. empirical outcomes',
    },
    rights: {
      social: 'Individual freedom vs. collective good',
      ethics: 'Personal autonomy vs. moral obligation',
      practical: 'Rights in principle vs. rights in practice',
      evidence: 'Theoretical rights vs. measured outcomes',
    },
    evidence: {
      ethics: 'Data-driven policy vs. values-based governance',
      practical: 'Research findings vs. implementation reality',
      social: 'Statistical outcomes vs. lived experience',
    },
    ethics: {
      practical: 'Moral imperative vs. pragmatic constraints',
      future: 'Present values vs. future consequences',
      precedent: 'Universal principles vs. historical norms',
    },
    social: {
      future: 'Community stability vs. need for change',
      practical: 'Social cohesion vs. operational complexity',
    },
  }

  if (topFor && topAgainst) {
    const t = tensions[topFor]?.[topAgainst] ?? tensions[topAgainst]?.[topFor]
    if (t) return t
  }

  const CAT_TENSIONS: Record<string, string> = {
    Economics:   'Market freedom vs. regulatory protection',
    Politics:    'State authority vs. civic autonomy',
    Technology:  'Innovation potential vs. societal risk',
    Science:     'Evidence-based policy vs. precautionary principle',
    Ethics:      'Universal principles vs. contextual judgment',
    Philosophy:  'Individual reason vs. collective wisdom',
    Culture:     'Cultural preservation vs. progressive change',
    Health:      'Public health mandate vs. personal choice',
    Environment: 'Economic development vs. ecological preservation',
    Education:   'Standardisation vs. local control',
  }

  return CAT_TENSIONS[category ?? ''] ?? 'Competing visions for the optimal policy outcome'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score, created_at')
    .eq('topic_id', id)
    .order('upvotes', { ascending: false })
    .limit(200)

  const args = rawArgs ?? []
  const forArgs  = args.filter((a) => a.side === 'blue')
  const agstArgs = args.filter((a) => a.side === 'red')

  const forThemes  = computeThemes(forArgs)
  const agstThemes = computeThemes(agstArgs)

  const forUpvotes  = forArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const agstUpvotes = agstArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const totalUp = forUpvotes + agstUpvotes

  const forStrength  = totalUp > 0 ? Math.round((forUpvotes  / totalUp) * 100) : 50
  const agstStrength = totalUp > 0 ? Math.round((agstUpvotes / totalUp) * 100) : 50

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const forRecent  = forArgs.filter((a) => new Date(a.created_at).getTime() >= recentCutoff).length
  const agstRecent = agstArgs.filter((a) => new Date(a.created_at).getTime() >= recentCutoff).length

  const forSide: NarrativeSide = {
    side: 'for',
    total_arguments: forArgs.length,
    total_upvotes: forUpvotes,
    avg_upvotes: forArgs.length > 0 ? Math.round(forUpvotes / forArgs.length) : 0,
    themes: forThemes,
    dominant_theme: forThemes[0]?.label ?? null,
    momentum_score: computeMomentum(forArgs),
    recent_argument_count: forRecent,
  }

  const agstSide: NarrativeSide = {
    side: 'against',
    total_arguments: agstArgs.length,
    total_upvotes: agstUpvotes,
    avg_upvotes: agstArgs.length > 0 ? Math.round(agstUpvotes / agstArgs.length) : 0,
    themes: agstThemes,
    dominant_theme: agstThemes[0]?.label ?? null,
    momentum_score: computeMomentum(agstArgs),
    recent_argument_count: agstRecent,
  }

  const leading_side: NarrativeBalance['leading_side'] =
    Math.abs(forStrength - agstStrength) <= 10
      ? 'balanced'
      : forStrength > agstStrength
      ? 'for'
      : 'against'

  const balance: NarrativeBalance = {
    for_strength: forStrength,
    against_strength: agstStrength,
    contested: Math.abs(forStrength - agstStrength) <= 10,
    leading_side,
    core_tension: deriveTension(topic.category, forThemes, agstThemes),
  }

  const totalArgs = args.length

  let analysisNote = ''
  if (totalArgs === 0) {
    analysisNote = 'No arguments posted yet. Be the first to shape the narrative.'
  } else if (totalArgs < 5) {
    analysisNote = 'Early-stage debate — narrative themes are forming. Check back as more arguments are posted.'
  } else if (balance.contested) {
    analysisNote = 'A genuinely contested debate. Both sides are making comparable narrative cases — the outcome is uncertain.'
  } else if (leading_side === 'for') {
    analysisNote = `The FOR narrative is stronger by argument quality and community engagement. The dominant frame is "${forSide.dominant_theme}".`
  } else if (leading_side === 'against') {
    analysisNote = `The AGAINST narrative leads in community support. The dominant frame is "${agstSide.dominant_theme}".`
  } else {
    analysisNote = 'Balanced argument quality — the debate is too close to call based on narrative strength alone.'
  }

  const result: NarrativeData = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    price: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    for_side: forSide,
    against_side: agstSide,
    balance,
    total_arguments: totalArgs,
    analysis_note: analysisNote,
  }

  return NextResponse.json(result)
}
