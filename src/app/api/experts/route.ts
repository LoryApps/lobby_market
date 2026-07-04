import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryExpert {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  tier: 'contributor' | 'expert' | 'sage'
  accepted_count: number
  category: string
  total_answers: number
  total_answer_upvotes: number
}

export interface CategorySection {
  category: string
  sages: CategoryExpert[]
  experts: CategoryExpert[]
  contributors: CategoryExpert[]
  total_experts: number
}

export interface ExpertsResponse {
  categories: CategorySection[]
  topSages: CategoryExpert[]
  stats: {
    total_sages: number
    total_experts: number
    total_contributors: number
    categories_with_experts: number
  }
}

// ─── GET /api/experts ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    // ── 1. Pull qa_user_expertise view joined with profiles ─────────────────────
    let query = supabase
      .from('qa_user_expertise')
      .select(`
        user_id,
        category,
        accepted_count,
        tier,
        profiles!qa_user_expertise_user_id_fkey (
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      `)
      .order('accepted_count', { ascending: false })

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    const { data: rawExpertise, error } = await query.limit(200)

    if (error) {
      console.error('qa_user_expertise query error:', error)
      // Fallback: return empty but valid response
      return NextResponse.json({
        categories: [],
        topSages: [],
        stats: { total_sages: 0, total_experts: 0, total_contributors: 0, categories_with_experts: 0 },
      } satisfies ExpertsResponse)
    }

    // ── 2. Fetch per-expert answer totals for richer display ────────────────────
    const userIds = [...new Set((rawExpertise ?? []).map((r) => r.user_id))]

    const answerStats: Record<string, { total_answers: number; total_answer_upvotes: number }> = {}

    if (userIds.length > 0) {
      const { data: rawAnswers } = await supabase
        .from('topic_answers')
        .select('author_id, upvotes')
        .in('author_id', userIds)

      for (const row of rawAnswers ?? []) {
        const prev = answerStats[row.author_id] ?? { total_answers: 0, total_answer_upvotes: 0 }
        answerStats[row.author_id] = {
          total_answers: prev.total_answers + 1,
          total_answer_upvotes: prev.total_answer_upvotes + (row.upvotes ?? 0),
        }
      }
    }

    // ── 3. Shape into CategoryExpert objects ────────────────────────────────────
    const allExperts: CategoryExpert[] = (rawExpertise ?? [])
      .filter((r) => r.profiles)
      .map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        const stats = answerStats[r.user_id] ?? { total_answers: 0, total_answer_upvotes: 0 }
        return {
          user_id: r.user_id,
          username: p?.username ?? '',
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          role: p?.role ?? 'person',
          clout: p?.clout ?? 0,
          tier: r.tier as CategoryExpert['tier'],
          accepted_count: r.accepted_count,
          category: r.category,
          ...stats,
        }
      })
      .filter((e) => e.username)

    // ── 4. Group by category ────────────────────────────────────────────────────
    const CATEGORY_ORDER = [
      'Politics', 'Economics', 'Technology', 'Ethics', 'Philosophy',
      'Science', 'Culture', 'Health', 'Environment', 'Education',
    ]

    const grouped: Record<string, CategoryExpert[]> = {}
    for (const expert of allExperts) {
      if (!grouped[expert.category]) grouped[expert.category] = []
      grouped[expert.category].push(expert)
    }

    const categories: CategorySection[] = Object.entries(grouped)
      .sort(([a], [b]) => {
        const ai = CATEGORY_ORDER.indexOf(a)
        const bi = CATEGORY_ORDER.indexOf(b)
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      .map(([cat, experts]) => ({
        category: cat,
        sages: experts.filter((e) => e.tier === 'sage').slice(0, 5),
        experts: experts.filter((e) => e.tier === 'expert').slice(0, 5),
        contributors: experts.filter((e) => e.tier === 'contributor').slice(0, 5),
        total_experts: experts.length,
      }))

    // ── 5. Platform-wide top sages (cross-category) ─────────────────────────────
    const topSageMap: Record<string, CategoryExpert & { total_accepted: number }> = {}
    for (const expert of allExperts.filter((e) => e.tier === 'sage')) {
      if (!topSageMap[expert.user_id]) {
        topSageMap[expert.user_id] = { ...expert, total_accepted: 0 }
      }
      topSageMap[expert.user_id].total_accepted += expert.accepted_count
    }
    const topSages = Object.values(topSageMap)
      .sort((a, b) => b.total_accepted - a.total_accepted)
      .slice(0, 10)

    // ── 6. Stats ────────────────────────────────────────────────────────────────
    const stats = {
      total_sages: allExperts.filter((e) => e.tier === 'sage').length,
      total_experts: allExperts.filter((e) => e.tier === 'expert').length,
      total_contributors: allExperts.filter((e) => e.tier === 'contributor').length,
      categories_with_experts: Object.keys(grouped).length,
    }

    return NextResponse.json({
      categories,
      topSages,
      stats,
    } satisfies ExpertsResponse)
  } catch (err) {
    console.error('GET /api/experts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
