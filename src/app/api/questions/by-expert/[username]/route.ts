import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpertAnswerItem {
  id: string
  content: string
  upvotes: number
  is_accepted: boolean
  created_at: string
  question: {
    id: string
    content: string
    upvotes: number
    answer_count: number
    is_answered: boolean
    created_at: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface ExpertTierInfo {
  category: string
  accepted_count: number
  tier: 'contributor' | 'expert' | 'sage'
}

export interface ExpertProfile {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  bio: string | null
  followers_count: number
  following_count: number
  total_arguments: number
}

export interface ByExpertResponse {
  expert: ExpertProfile
  expertise: ExpertTierInfo[]
  answers: ExpertAnswerItem[]
  stats: {
    total_answers: number
    accepted_answers: number
    total_upvotes: number
    categories_contributed: number
  }
}

// ─── GET /api/questions/by-expert/[username] ──────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = await createClient()
    const username = params.username

    // ── 1. Resolve profile ──────────────────────────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, bio, followers_count, following_count, total_arguments')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Expert not found' }, { status: 404 })
    }

    const userId = profile.id

    // ── 2. Fetch expertise tiers ────────────────────────────────────────────────
    const { data: rawExpertise } = await supabase
      .from('qa_user_expertise')
      .select('category, accepted_count, tier')
      .eq('user_id', userId)
      .order('accepted_count', { ascending: false })

    const expertise: ExpertTierInfo[] = (rawExpertise ?? []).map((r) => ({
      category: r.category,
      accepted_count: r.accepted_count,
      tier: r.tier as ExpertTierInfo['tier'],
    }))

    // ── 3. Fetch answers with joined question + topic ───────────────────────────
    const { data: rawAnswers, error: answersError } = await supabase
      .from('topic_answers')
      .select(`
        id,
        content,
        upvotes,
        is_accepted,
        created_at,
        topic_questions!topic_answers_question_id_fkey (
          id,
          content,
          upvotes,
          answer_count,
          is_answered,
          created_at
        ),
        topics!topic_answers_topic_id_fkey (
          id,
          statement,
          category,
          status
        )
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (answersError) {
      console.error('topic_answers query error:', answersError)
    }

    const answers: ExpertAnswerItem[] = (rawAnswers ?? []).map((r) => {
      const q = Array.isArray(r.topic_questions) ? r.topic_questions[0] : r.topic_questions
      const t = Array.isArray(r.topics) ? r.topics[0] : r.topics
      return {
        id: r.id,
        content: r.content,
        upvotes: r.upvotes,
        is_accepted: r.is_accepted,
        created_at: r.created_at,
        question: q
          ? {
              id: q.id,
              content: q.content,
              upvotes: q.upvotes,
              answer_count: q.answer_count,
              is_answered: q.is_answered,
              created_at: q.created_at,
            }
          : null,
        topic: t
          ? {
              id: t.id,
              statement: t.statement,
              category: t.category,
              status: t.status,
            }
          : null,
      }
    })

    // ── 4. Compute stats ────────────────────────────────────────────────────────
    const stats = {
      total_answers: answers.length,
      accepted_answers: answers.filter((a) => a.is_accepted).length,
      total_upvotes: answers.reduce((acc, a) => acc + (a.upvotes ?? 0), 0),
      categories_contributed: expertise.length,
    }

    return NextResponse.json({
      expert: {
        user_id: userId,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout,
        bio: profile.bio,
        followers_count: profile.followers_count ?? 0,
        following_count: profile.following_count ?? 0,
        total_arguments: profile.total_arguments ?? 0,
      },
      expertise,
      answers,
      stats,
    } satisfies ByExpertResponse)
  } catch (err) {
    console.error('GET /api/questions/by-expert/[username] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
