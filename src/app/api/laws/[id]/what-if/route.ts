import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'should', 'could', 'would', 'their', 'there', 'these', 'those', 'about',
  'above', 'after', 'again', 'being', 'below', 'between', 'both', 'cannot',
  'does', 'during', 'every', 'from', 'further', 'have', 'here', 'itself',
  'just', 'more', 'most', 'must', 'need', 'never', 'only', 'other', 'over',
  'same', 'since', 'some', 'still', 'such', 'than', 'that', 'them', 'then',
  'through', 'under', 'until', 'were', 'what', 'when', 'where', 'which',
  'while', 'with', 'within', 'without', 'your', 'this', 'will', 'make',
  'also', 'into', 'been', 'very', 'they', 'people', 'like',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w))
    .slice(0, 12)
}

// ─── Policy domain map ────────────────────────────────────────────────────────
// Maps category → civic impact domains that repealing this law would affect

const CATEGORY_DOMAINS: Record<string, { domain: string; description: string; risk: 'high' | 'medium' | 'low' }[]> = {
  Economics: [
    { domain: 'Market Regulation', description: 'Price mechanisms and competition rules revert to pre-consensus defaults', risk: 'high' },
    { domain: 'Public Spending', description: 'Budget allocations linked to this consensus would be re-debated', risk: 'medium' },
    { domain: 'Labour Standards', description: 'Employment conditions and wage floors could weaken', risk: 'medium' },
  ],
  Politics: [
    { domain: 'Civic Norms', description: 'Established democratic expectations would need re-establishing', risk: 'high' },
    { domain: 'Institutional Trust', description: 'Repealing settled consensus erodes platform legitimacy', risk: 'high' },
    { domain: 'Power Balance', description: 'Political relationships built on this consensus would shift', risk: 'medium' },
  ],
  Technology: [
    { domain: 'Digital Rights', description: 'User protections and data standards revert to contested territory', risk: 'high' },
    { domain: 'Innovation Policy', description: 'Tech sector incentives and guardrails would be uncertain', risk: 'medium' },
    { domain: 'Platform Accountability', description: 'Liability and responsibility frameworks become unclear', risk: 'low' },
  ],
  Science: [
    { domain: 'Research Funding', description: 'Science policy direction and public investment becomes contested', risk: 'medium' },
    { domain: 'Public Health', description: 'Evidence-based health guidance could be undermined', risk: 'high' },
    { domain: 'Regulatory Science', description: 'Safety standards and approval processes revert to debate', risk: 'medium' },
  ],
  Ethics: [
    { domain: 'Moral Standards', description: 'Collective ethical norms that were settled re-enter debate', risk: 'high' },
    { domain: 'Rights Framework', description: 'Rights protections built on this consensus are jeopardised', risk: 'high' },
    { domain: 'Social Contracts', description: 'Community expectations of fair treatment become uncertain', risk: 'medium' },
  ],
  Philosophy: [
    { domain: 'Foundational Principles', description: 'Core civic values codified in this law would be contested', risk: 'high' },
    { domain: 'Public Discourse', description: 'The terms of civic debate would need resetting', risk: 'medium' },
    { domain: 'Normative Framework', description: 'What counts as a valid civic argument shifts', risk: 'low' },
  ],
  Culture: [
    { domain: 'Cultural Norms', description: 'Settled social expectations would become contested again', risk: 'medium' },
    { domain: 'Creative Rights', description: 'Intellectual and artistic protections could weaken', risk: 'low' },
    { domain: 'Identity Recognition', description: 'Community acknowledgements built on this law would be disputed', risk: 'medium' },
  ],
  Health: [
    { domain: 'Medical Standards', description: 'Care quality and treatment norms could regress', risk: 'high' },
    { domain: 'Public Prevention', description: 'Preventive measures and screening programmes become uncertain', risk: 'high' },
    { domain: 'Health Equity', description: 'Fair access to services could be jeopardised', risk: 'medium' },
  ],
  Environment: [
    { domain: 'Climate Commitments', description: 'Emissions targets and green transition plans become contested', risk: 'high' },
    { domain: 'Natural Resources', description: 'Protection and sustainable use of natural assets could weaken', risk: 'high' },
    { domain: 'Pollution Limits', description: 'Environmental standards and enforcement become uncertain', risk: 'medium' },
  ],
  Education: [
    { domain: 'Curriculum Standards', description: 'What is taught and how it is assessed would need re-agreeing', risk: 'medium' },
    { domain: 'Access & Equity', description: 'Fair access to quality education could be contested', risk: 'high' },
    { domain: 'Institutional Quality', description: 'Performance benchmarks and accountability become uncertain', risk: 'low' },
  ],
}

// ─── Response types ────────────────────────────────────────────────────────────

export interface WhatIfCascadeLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  shared_keywords: string[]
  cascade_reason: string
}

export interface WhatIfTopicReSurface {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  against_pct: number
}

export interface WhatIfDissentArgument {
  id: string
  content: string
  upvotes: number
  ai_grade: string | null
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface WhatIfImpactDomain {
  domain: string
  description: string
  risk: 'high' | 'medium' | 'low'
}

export interface WhatIfResponse {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string
  topic_id: string
  // Citizens who opposed this law — they would gain
  dissent_count: number
  dissent_pct: number
  // Laws that build on this one — might need re-evaluation
  cascade_laws: WhatIfCascadeLaw[]
  // Topics that would likely resurface in debate
  resurface_topics: WhatIfTopicReSurface[]
  // Top against-side arguments that would regain prominence
  dissent_arguments: WhatIfDissentArgument[]
  // Policy domains that would be impacted
  impact_domains: WhatIfImpactDomain[]
  // Confidence that repeal would cascade significantly
  cascade_confidence: number
  cached_at: string
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

  // Fetch law metadata
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const keywords = extractKeywords(law.statement)

  // Parallel data fetches
  const [
    cascadeResult,
    resurface1Result,
    resurface2Result,
    dissentResult,
  ] = await Promise.all([
    // Laws with keyword overlap (might build on this one)
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .neq('id', id)
      .eq('category', law.category)
      .order('established_at', { ascending: false })
      .limit(20),

    // Active topics in same category (similar debates that would resurface)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('category', law.category)
      .in('status', ['active', 'proposed'])
      .order('total_votes', { ascending: false })
      .limit(10),

    // Historical topics that failed (would get a second chance)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('category', law.category)
      .eq('status', 'failed')
      .order('total_votes', { ascending: false })
      .limit(6),

    // Top against-side arguments from the original topic
    supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        upvotes,
        ai_grade,
        profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url)
      `)
      .eq('topic_id', law.topic_id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(5),
  ])

  type RawDissentArg = {
    id: string
    content: string
    upvotes: number
    ai_grade: string | null
    profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
  }

  const allCatLaws = (cascadeResult.data ?? []) as Array<{
    id: string; statement: string; category: string | null;
    blue_pct: number; total_votes: number; established_at: string
  }>

  // Filter cascade laws by keyword overlap
  const cascadeLaws: WhatIfCascadeLaw[] = allCatLaws
    .map((l) => {
      const lawKws = extractKeywords(l.statement)
      const shared = keywords.filter((k) => lawKws.includes(k))
      return { ...l, shared_keywords: shared }
    })
    .filter((l) => l.shared_keywords.length >= 1)
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
      established_at: l.established_at,
      shared_keywords: l.shared_keywords,
      cascade_reason: `Shares ${l.shared_keywords.slice(0, 2).join(', ')} with this law — would need re-evaluation`,
    }))

  // Resurface topics: active topics most similar to this law's domain
  const allActive = (resurface1Result.data ?? []) as Array<{
    id: string; statement: string; category: string | null; status: string;
    blue_pct: number; total_votes: number; created_at: string
  }>

  const allFailed = (resurface2Result.data ?? []) as typeof allActive

  const resurfaceTopics: WhatIfTopicReSurface[] = [
    ...allActive.slice(0, 4).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      created_at: t.created_at,
      against_pct: Math.round(100 - (t.blue_pct ?? 50)),
    })),
    ...allFailed.slice(0, 3).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      created_at: t.created_at,
      against_pct: Math.round(100 - (t.blue_pct ?? 50)),
    })),
  ].slice(0, 6)

  const dissentArgs: WhatIfDissentArgument[] = ((dissentResult.data ?? []) as unknown as RawDissentArg[]).map((a) => ({
    id: a.id,
    content: a.content,
    upvotes: a.upvotes,
    ai_grade: a.ai_grade,
    author_username: a.profiles?.username ?? null,
    author_display_name: a.profiles?.display_name ?? null,
    author_avatar_url: a.profiles?.avatar_url ?? null,
  }))

  const impactDomains: WhatIfImpactDomain[] = (CATEGORY_DOMAINS[law.category ?? ''] ?? [
    { domain: 'Civic Stability', description: 'Settled consensus would need to be re-established through new debate', risk: 'high' as const },
    { domain: 'Community Trust', description: 'Confidence in the platform\'s permanence of law would be tested', risk: 'medium' as const },
    { domain: 'Policy Continuity', description: 'Downstream decisions built on this law would become uncertain', risk: 'low' as const },
  ])

  const againstPct = Math.round(100 - (law.blue_pct ?? 50))
  const dissentCount = Math.round(((law.total_votes ?? 0) * againstPct) / 100)

  // Cascade confidence: more cascade laws + strong dissent = higher risk
  const cascadeConfidence = Math.min(100, Math.round(
    (cascadeLaws.length * 12) +
    (againstPct * 0.8) +
    (resurfaceTopics.length * 5)
  ))

  return NextResponse.json({
    law_id: law.id,
    law_statement: law.statement,
    law_category: law.category ?? null,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    law_established_at: law.established_at,
    topic_id: law.topic_id,
    dissent_count: dissentCount,
    dissent_pct: againstPct,
    cascade_laws: cascadeLaws,
    resurface_topics: resurfaceTopics,
    dissent_arguments: dissentArgs,
    impact_domains: impactDomains,
    cascade_confidence: cascadeConfidence,
    cached_at: new Date().toISOString(),
  } satisfies WhatIfResponse)
}
