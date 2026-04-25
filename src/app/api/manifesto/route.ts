import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ManifestoSection {
  title: string
  body: string
}

export interface ManifestoResult {
  title: string
  declaration: string
  sections: ManifestoSection[]
  signoff: string
  archetype: string
  archetype_description: string
  generated_at: string
  stats: {
    total_votes: number
    categories_covered: number
    top_category: string | null
    for_pct: number
    laws_supported: number
  }
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string' || !s.trim()) return fallback
  return s.slice(0, max)
}

function ensureSections(val: unknown): ManifestoSection[] {
  if (!Array.isArray(val)) return []
  return val
    .filter(
      (s): s is { title: string; body: string } =>
        s && typeof s.title === 'string' && typeof s.body === 'string'
    )
    .slice(0, 6)
    .map((s) => ({ title: s.title.slice(0, 80), body: s.body.slice(0, 400) }))
}

// ─── POST /api/manifesto ──────────────────────────────────────────────────────

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<ManifestoResult>,
      { status: 503 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch user profile ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, total_votes, clout, reputation_score, role, category_preferences')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── 2. Fetch recent votes with topic info ──────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('side, reason, topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150)

  const votes = (votesRaw ?? []) as Array<{
    side: string
    reason: string | null
    topic_id: string
    created_at: string
  }>

  if (votes.length < 5) {
    return NextResponse.json(
      { insufficient_data: true } satisfies Partial<ManifestoResult>,
      { status: 422 }
    )
  }

  // ── 3. Get topic details ───────────────────────────────────────────────────
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .in('id', topicIds)

  const topicMap = new Map(
    (topicsRaw ?? []).map((t) => [
      t.id,
      {
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        blue_pct: t.blue_pct as number,
      },
    ])
  )

  // ── 4. Build category breakdown ────────────────────────────────────────────
  const categoryStats = new Map<string, { for: number; against: number }>()
  let forVotes = 0
  let lawsSupported = 0

  for (const v of votes) {
    const topic = topicMap.get(v.topic_id)
    if (!topic) continue
    const cat = topic.category ?? 'Other'
    const existing = categoryStats.get(cat) ?? { for: 0, against: 0 }
    if (v.side === 'blue') {
      existing.for++
      forVotes++
    } else {
      existing.against++
    }
    categoryStats.set(cat, existing)

    if (topic.status === 'law' && v.side === 'blue') lawsSupported++
  }

  const topCategory =
    Array.from(categoryStats.entries()).sort(
      (a, b) => b[1].for + b[1].against - (a[1].for + a[1].against)
    )[0]?.[0] ?? null

  // ── 5. Sample topic positions for Claude ──────────────────────────────────
  // Take up to 30 interesting positions across categories
  const sampleVotes = votes.slice(0, 80).reduce<
    Array<{ category: string; statement: string; side: string; reason?: string }>
  >((acc, v) => {
    const topic = topicMap.get(v.topic_id)
    if (!topic) return acc
    acc.push({
      category: topic.category ?? 'Other',
      statement: topic.statement.slice(0, 120),
      side: v.side === 'blue' ? 'FOR' : 'AGAINST',
      ...(v.reason ? { reason: v.reason } : {}),
    })
    return acc
  }, [])

  const categoryBreakdown = Array.from(categoryStats.entries())
    .sort((a, b) => b[1].for + b[1].against - (a[1].for + a[1].against))
    .slice(0, 8)
    .map(([cat, stats]) => ({
      category: cat,
      total: stats.for + stats.against,
      for_pct: Math.round((stats.for / (stats.for + stats.against)) * 100),
    }))

  const displayName = profile.display_name || profile.username

  // ── 6. Generate manifesto with Claude ────────────────────────────────────
  const client = new Anthropic()

  const prompt = `You are generating a personal "Civic Manifesto" for a user of Lobby Market, a civic consensus platform.

User: ${displayName}
Role: ${profile.role}
Total votes cast: ${votes.length}
Reputation score: ${profile.reputation_score}

Category engagement (most active first):
${categoryBreakdown.map((c) => `- ${c.category}: ${c.total} votes, ${c.for_pct}% FOR`).join('\n')}

Sample of their positions (up to 30):
${sampleVotes
  .slice(0, 30)
  .map((v) => `[${v.category}] ${v.side}: "${v.statement}"${v.reason ? ` — "${v.reason}"` : ''}`)
  .join('\n')}

Based on this voting history, generate a personal Civic Manifesto. This should feel like a real political declaration — formal but personal, principled but specific to their actual positions.

Return ONLY valid JSON with exactly this shape:
{
  "archetype": "short archetype name (2-4 words, e.g. 'The Progressive Pragmatist', 'The Liberty Hawk', 'The Social Democrat')",
  "archetype_description": "one sentence describing this civic personality (max 100 chars)",
  "title": "manifesto title (e.g. 'A Declaration of Civic Principles')",
  "declaration": "opening declaration paragraph — 2-3 sentences, bold and principled (max 280 chars)",
  "sections": [
    {
      "title": "section title (max 50 chars)",
      "body": "2-3 sentences elaborating on this principle or policy stance (max 350 chars)"
    }
  ],
  "signoff": "short closing statement, 1 sentence (max 120 chars)"
}

Requirements:
- Exactly 3-4 sections, each grounded in their actual voting patterns
- The archetype must be creative and specific, not generic
- Tone: formal, declarative, like a real political document
- Reference their top categories by name
- Do NOT include the user's name in the manifesto text itself
- Return ONLY the JSON, no markdown fences`

  let raw: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You generate personal civic manifestos as JSON. Return only valid JSON, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    })
    raw =
      message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<ManifestoResult>,
      { status: 503 }
    )
  }

  // ── 7. Parse and validate response ────────────────────────────────────────
  let parsed: Record<string, unknown>
  try {
    // Strip markdown fences if Claude added them despite instructions
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<ManifestoResult>,
      { status: 503 }
    )
  }

  const result: ManifestoResult = {
    title: clampStr(parsed.title, 120, 'A Declaration of Civic Principles'),
    declaration: clampStr(parsed.declaration, 400, 'I stand for evidence-based governance, civic participation, and the power of consensus.'),
    archetype: clampStr(parsed.archetype, 60, 'The Civic Advocate'),
    archetype_description: clampStr(parsed.archetype_description, 150, 'A principled voice in the public square.'),
    sections: ensureSections(parsed.sections),
    signoff: clampStr(parsed.signoff, 160, 'I cast my vote in service of a more just and evidence-driven democracy.'),
    generated_at: new Date().toISOString(),
    stats: {
      total_votes: votes.length,
      categories_covered: categoryStats.size,
      top_category: topCategory,
      for_pct: votes.length > 0 ? Math.round((forVotes / votes.length) * 100) : 50,
      laws_supported: lawsSupported,
    },
  }

  return NextResponse.json(result)
}
