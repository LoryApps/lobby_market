import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  submissions: number
  total_upvotes: number
  for_count: number
  against_count: number
  neutral_count: number
  rank: number
}

export interface EvidenceQualityTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  quality_score: number
  bias_score: number
  evidence_count: number
  key_claim: string
  summary: string
  rank: number
}

export interface TrustedDomain {
  domain: string
  total_submissions: number
  total_upvotes: number
  for_count: number
  against_count: number
  neutral_count: number
  bias_label: 'FOR-leaning' | 'AGAINST-leaning' | 'Balanced'
  rank: number
}

export interface EvidenceLeaderboardResponse {
  topContributors: EvidenceContributor[]
  topQualityTopics: EvidenceQualityTopic[]
  trustedDomains: TrustedDomain[]
  platformStats: {
    total_submissions: number
    total_upvotes: number
    total_contributors: number
    topics_with_evidence: number
    topics_analyzed: number
    avg_quality_score: number
  }
  generatedAt: string
}

// ─── GET /api/leaderboard/evidence ───────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Top contributors ───────────────────────────────────────────────────
  const { data: rawEvidence } = await supabase
    .from('topic_evidence')
    .select(`
      user_id,
      upvotes,
      side,
      submitter:profiles!topic_evidence_user_id_fkey(
        username, display_name, avatar_url, role, clout
      )
    `)
    .order('created_at', { ascending: false })

  // Aggregate by user in JS (Supabase doesn't support GROUP BY via JS client)
  const contributorMap: Record<
    string,
    {
      user_id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      submissions: number
      total_upvotes: number
      for_count: number
      against_count: number
      neutral_count: number
    }
  > = {}

  for (const row of rawEvidence ?? []) {
    const profile = Array.isArray(row.submitter) ? row.submitter[0] : row.submitter
    if (!profile || !row.user_id) continue
    const uid = row.user_id as string
    if (!contributorMap[uid]) {
      contributorMap[uid] = {
        user_id: uid,
        username: (profile as { username: string }).username,
        display_name: (profile as { display_name: string | null }).display_name,
        avatar_url: (profile as { avatar_url: string | null }).avatar_url,
        role: (profile as { role: string }).role,
        clout: (profile as { clout: number }).clout ?? 0,
        submissions: 0,
        total_upvotes: 0,
        for_count: 0,
        against_count: 0,
        neutral_count: 0,
      }
    }
    contributorMap[uid].submissions++
    contributorMap[uid].total_upvotes += (row.upvotes as number) ?? 0
    if (row.side === 'for') contributorMap[uid].for_count++
    else if (row.side === 'against') contributorMap[uid].against_count++
    else contributorMap[uid].neutral_count++
  }

  const topContributors: EvidenceContributor[] = Object.values(contributorMap)
    .sort((a, b) => b.total_upvotes - a.total_upvotes || b.submissions - a.submissions)
    .slice(0, 25)
    .map((c, i) => ({ ...c, rank: i + 1 }))

  // ── 2. Top quality topics ─────────────────────────────────────────────────
  const { data: analysisRows } = await supabase
    .from('topic_evidence_analysis')
    .select(`
      topic_id,
      quality_score,
      bias_score,
      evidence_count,
      key_claim,
      summary,
      topic:topics!topic_evidence_analysis_topic_id_fkey(
        id, statement, category, status, blue_pct
      )
    `)
    .gte('quality_score', 6)
    .order('quality_score', { ascending: false })
    .order('evidence_count', { ascending: false })
    .limit(25)

  const topQualityTopics: EvidenceQualityTopic[] = (analysisRows ?? [])
    .map((row, i) => {
      const t = Array.isArray(row.topic) ? row.topic[0] : row.topic
      if (!t) return null
      return {
        id: (t as { id: string }).id,
        statement: (t as { statement: string }).statement,
        category: (t as { category: string | null }).category,
        status: (t as { status: string }).status,
        blue_pct: (t as { blue_pct: number }).blue_pct ?? 50,
        quality_score: row.quality_score as number,
        bias_score: row.bias_score as number,
        evidence_count: row.evidence_count as number,
        key_claim: (row.key_claim as string) ?? '',
        summary: (row.summary as string) ?? '',
        rank: i + 1,
      }
    })
    .filter(Boolean) as EvidenceQualityTopic[]

  // ── 3. Trusted domains ────────────────────────────────────────────────────
  const domainMap: Record<
    string,
    { domain: string; total_submissions: number; total_upvotes: number; for_count: number; against_count: number; neutral_count: number }
  > = {}

  for (const row of rawEvidence ?? []) {
    // domain is a generated column; we access it directly
    const domain = (row as { domain?: string }).domain
    if (!domain) continue
    if (!domainMap[domain]) {
      domainMap[domain] = { domain, total_submissions: 0, total_upvotes: 0, for_count: 0, against_count: 0, neutral_count: 0 }
    }
    domainMap[domain].total_submissions++
    domainMap[domain].total_upvotes += (row.upvotes as number) ?? 0
    if (row.side === 'for') domainMap[domain].for_count++
    else if (row.side === 'against') domainMap[domain].against_count++
    else domainMap[domain].neutral_count++
  }

  const trustedDomains: TrustedDomain[] = Object.values(domainMap)
    .filter((d) => d.total_upvotes > 0)
    .sort((a, b) => b.total_upvotes - a.total_upvotes || b.total_submissions - a.total_submissions)
    .slice(0, 20)
    .map((d, i) => {
      const forRatio = d.total_submissions > 0 ? d.for_count / d.total_submissions : 0
      const againstRatio = d.total_submissions > 0 ? d.against_count / d.total_submissions : 0
      let biasLabel: TrustedDomain['bias_label'] = 'Balanced'
      if (forRatio > 0.6) biasLabel = 'FOR-leaning'
      else if (againstRatio > 0.6) biasLabel = 'AGAINST-leaning'
      return { ...d, bias_label: biasLabel, rank: i + 1 }
    })

  // ── 4. Platform stats ─────────────────────────────────────────────────────
  const allEvidence = rawEvidence ?? []
  const totalUpvotes = allEvidence.reduce((sum, r) => sum + ((r.upvotes as number) ?? 0), 0)
  const uniqueTopics = new Set(allEvidence.map((r) => (r as { topic_id: string }).topic_id)).size

  const { count: analysisCount } = await supabase
    .from('topic_evidence_analysis')
    .select('*', { count: 'exact', head: true })

  const { data: avgQualityData } = await supabase
    .from('topic_evidence_analysis')
    .select('quality_score')

  const avgQuality =
    (avgQualityData ?? []).length > 0
      ? (avgQualityData ?? []).reduce((s, r) => s + ((r.quality_score as number) ?? 0), 0) /
        (avgQualityData ?? []).length
      : 0

  return NextResponse.json({
    topContributors,
    topQualityTopics,
    trustedDomains,
    platformStats: {
      total_submissions: allEvidence.length,
      total_upvotes: totalUpvotes,
      total_contributors: Object.keys(contributorMap).length,
      topics_with_evidence: uniqueTopics,
      topics_analyzed: analysisCount ?? 0,
      avg_quality_score: Math.round(avgQuality * 10) / 10,
    },
    generatedAt: new Date().toISOString(),
  } satisfies EvidenceLeaderboardResponse)
}
