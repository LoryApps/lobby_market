import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DeliberationPost {
  id: string
  assembly_id: string
  author_id: string
  round_number: number
  content: string
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  is_chair: boolean
}

export interface AssemblyDetailResponse {
  id: string
  title: string
  question: string
  status: 'forming' | 'deliberating' | 'concluded'
  max_members: number
  deliberation_rounds: number
  convened_at: string
  concluded_at: string | null
  recommendation: string | null
  stance: string | null
  recommendation_votes_for: number
  recommendation_votes_against: number
  created_at: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  members: {
    id: string
    user_id: string
    is_chair: boolean
    final_stance: string | null
    joined_at: string
    profile: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }[]
  deliberations: DeliberationPost[]
  user_is_member: boolean
  user_is_chair: boolean
  user_reaction: string | null
  endorse_count: number
  question_count: number
  object_count: number
}

// ─── GET /api/assemblies/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    const { data: assembly, error } = await supabase
      .from('citizens_assemblies')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !assembly) {
      if (error?.code === '42P01') {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Assembly not found' }, { status: 404 })
    }

    // Topic
    let topicStatement: string | null = null
    let topicCategory: string | null = null
    if (assembly.topic_id) {
      const { data: topic } = await supabase
        .from('topics')
        .select('statement, category')
        .eq('id', assembly.topic_id as string)
        .single()
      topicStatement = topic?.statement ?? null
      topicCategory = topic?.category ?? null
    }

    // Members
    const { data: membersRaw } = await supabase
      .from('assembly_members')
      .select('*, profiles:user_id(username, display_name, avatar_url, role)')
      .eq('assembly_id', params.id)
      .order('joined_at', { ascending: true })

    const members = (membersRaw ?? []).map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      is_chair: m.is_chair as boolean,
      final_stance: m.final_stance as string | null,
      joined_at: m.joined_at as string,
      profile: (m as { profiles?: unknown }).profiles as {
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      } | null,
    }))

    // Chair ids for marking
    const chairIds = new Set(members.filter(m => m.is_chair).map(m => m.user_id))

    // Deliberations
    const { data: delibsRaw } = await supabase
      .from('assembly_deliberations')
      .select('*, profiles:author_id(username, display_name, avatar_url, role)')
      .eq('assembly_id', params.id)
      .order('created_at', { ascending: true })

    const deliberations: DeliberationPost[] = (delibsRaw ?? []).map((d) => ({
      id: d.id as string,
      assembly_id: d.assembly_id as string,
      author_id: d.author_id as string,
      round_number: d.round_number as number,
      content: d.content as string,
      created_at: d.created_at as string,
      author: (d as { profiles?: unknown }).profiles as DeliberationPost['author'],
      is_chair: chairIds.has(d.author_id as string),
    }))

    // Reactions
    const { data: reactions } = await supabase
      .from('assembly_observer_reactions')
      .select('reaction, user_id')
      .eq('assembly_id', params.id)

    const endorseCount = (reactions ?? []).filter(r => r.reaction === 'endorse').length
    const questionCount = (reactions ?? []).filter(r => r.reaction === 'question').length
    const objectCount = (reactions ?? []).filter(r => r.reaction === 'object').length
    const userReaction = user
      ? (reactions ?? []).find(r => r.user_id === user.id)?.reaction ?? null
      : null

    const response: AssemblyDetailResponse = {
      id: assembly.id as string,
      title: assembly.title as string,
      question: assembly.question as string,
      status: assembly.status as AssemblyDetailResponse['status'],
      max_members: assembly.max_members as number,
      deliberation_rounds: assembly.deliberation_rounds as number,
      convened_at: assembly.convened_at as string,
      concluded_at: assembly.concluded_at as string | null,
      recommendation: assembly.recommendation as string | null,
      stance: assembly.stance as string | null,
      recommendation_votes_for: assembly.recommendation_votes_for as number,
      recommendation_votes_against: assembly.recommendation_votes_against as number,
      created_at: assembly.created_at as string,
      topic_id: assembly.topic_id as string | null,
      topic_statement: topicStatement,
      topic_category: topicCategory,
      members,
      deliberations,
      user_is_member: user ? members.some(m => m.user_id === user.id) : false,
      user_is_chair: user ? members.some(m => m.user_id === user.id && m.is_chair) : false,
      user_reaction: userReaction as string | null,
      endorse_count: endorseCount,
      question_count: questionCount,
      object_count: objectCount,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST /api/assemblies/[id] — post a deliberation ──────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    action?: string
    content?: string
    round_number?: number
    recommendation?: string
    stance?: string
  }

  // ── Add deliberation post ──────────────────────────────────────────────────
  if (body.action === 'deliberate') {
    const content = body.content?.trim()
    if (!content || content.length < 20) {
      return NextResponse.json({ error: 'Post must be at least 20 characters' }, { status: 400 })
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: 'Post must be under 1000 characters' }, { status: 400 })
    }

    // Verify membership
    const { data: member } = await supabase
      .from('assembly_members')
      .select('id')
      .eq('assembly_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'You are not a member of this assembly' }, { status: 403 })
    }

    const { error } = await supabase.from('assembly_deliberations').insert({
      assembly_id: params.id,
      author_id: user.id,
      round_number: body.round_number ?? 1,
      content,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  // ── Submit recommendation (chair only) ────────────────────────────────────
  if (body.action === 'conclude') {
    const recommendation = body.recommendation?.trim()
    if (!recommendation || recommendation.length < 50) {
      return NextResponse.json({ error: 'Recommendation must be at least 50 characters' }, { status: 400 })
    }

    const { data: member } = await supabase
      .from('assembly_members')
      .select('is_chair')
      .eq('assembly_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!(member as { is_chair?: boolean } | null)?.is_chair) {
      return NextResponse.json({ error: 'Only the assembly chair can submit the recommendation' }, { status: 403 })
    }

    const { error } = await supabase
      .from('citizens_assemblies')
      .update({
        status: 'concluded',
        recommendation,
        stance: body.stance ?? null,
        concluded_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
