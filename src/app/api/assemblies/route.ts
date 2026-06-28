import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssemblyMember {
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
}

export interface AssemblyRow {
  id: string
  topic_id: string | null
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
  topic_statement: string | null
  topic_category: string | null
  member_count: number
  members: AssemblyMember[]
  user_is_member: boolean
  user_reaction: string | null
}

export interface AssembliesResponse {
  assemblies: AssemblyRow[]
  total: number
}

// ─── GET /api/assemblies ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    // ─── Fetch assemblies ────────────────────────────────────────────────────
    let query = supabase
      .from('citizens_assemblies')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: rawAssemblies, count, error } = await query

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ assemblies: [], total: 0 } satisfies AssembliesResponse)
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!rawAssemblies || rawAssemblies.length === 0) {
      return NextResponse.json({ assemblies: [], total: count ?? 0 } satisfies AssembliesResponse)
    }

    const assemblyIds = rawAssemblies.map((a) => a.id as string)

    // ─── Fetch topics ────────────────────────────────────────────────────────
    const topicIds = rawAssemblies
      .map((a) => a.topic_id as string | null)
      .filter(Boolean) as string[]
    const { data: topics } =
      topicIds.length > 0
        ? await supabase
            .from('topics')
            .select('id, statement, category')
            .in('id', topicIds)
        : { data: [] }

    const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

    // ─── Fetch members with profiles ─────────────────────────────────────────
    const { data: membersRaw } = await supabase
      .from('assembly_members')
      .select('*, profiles:user_id(username, display_name, avatar_url, role)')
      .in('assembly_id', assemblyIds)
      .order('joined_at', { ascending: true })

    const membersByAssembly = new Map<string, AssemblyMember[]>()
    for (const m of membersRaw ?? []) {
      const assemblyId = m.assembly_id as string
      if (!membersByAssembly.has(assemblyId)) membersByAssembly.set(assemblyId, [])
      membersByAssembly.get(assemblyId)!.push({
        id: m.id as string,
        user_id: m.user_id as string,
        is_chair: m.is_chair as boolean,
        final_stance: m.final_stance as string | null,
        joined_at: m.joined_at as string,
        profile: (m as { profiles?: unknown }).profiles as AssemblyMember['profile'],
      })
    }

    // ─── Fetch user reactions ────────────────────────────────────────────────
    const reactionsByAssembly = new Map<string, string>()
    if (user) {
      const { data: reactions } = await supabase
        .from('assembly_observer_reactions')
        .select('assembly_id, reaction')
        .eq('user_id', user.id)
        .in('assembly_id', assemblyIds)

      for (const r of reactions ?? []) {
        reactionsByAssembly.set(r.assembly_id as string, r.reaction as string)
      }
    }

    // ─── Build response ──────────────────────────────────────────────────────
    const assemblies: AssemblyRow[] = rawAssemblies.map((a) => {
      const members = membersByAssembly.get(a.id as string) ?? []
      const topic = topicMap.get(a.topic_id as string)
      return {
        id: a.id as string,
        topic_id: a.topic_id as string | null,
        title: a.title as string,
        question: a.question as string,
        status: a.status as AssemblyRow['status'],
        max_members: a.max_members as number,
        deliberation_rounds: a.deliberation_rounds as number,
        convened_at: a.convened_at as string,
        concluded_at: a.concluded_at as string | null,
        recommendation: a.recommendation as string | null,
        stance: a.stance as string | null,
        recommendation_votes_for: a.recommendation_votes_for as number,
        recommendation_votes_against: a.recommendation_votes_against as number,
        created_at: a.created_at as string,
        topic_statement: topic?.statement ?? null,
        topic_category: topic?.category ?? null,
        member_count: members.length,
        members: members.slice(0, 6),
        user_is_member: user
          ? members.some((m) => m.user_id === user.id)
          : false,
        user_reaction: reactionsByAssembly.get(a.id as string) ?? null,
      }
    })

    return NextResponse.json({ assemblies, total: count ?? 0 } satisfies AssembliesResponse)
  } catch {
    return NextResponse.json({ assemblies: [], total: 0 } satisfies AssembliesResponse)
  }
}

// ─── POST /api/assemblies ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    title?: string
    question?: string
    topic_id?: string | null
    max_members?: number
  }

  const title = body.title?.trim()
  const question = body.question?.trim()

  if (!title || title.length < 10) {
    return NextResponse.json({ error: 'Title must be at least 10 characters' }, { status: 400 })
  }
  if (!question || question.length < 20) {
    return NextResponse.json({ error: 'Question must be at least 20 characters' }, { status: 400 })
  }

  const maxMembers = Math.min(Math.max(body.max_members ?? 12, 6), 20)

  const { data: assembly, error } = await supabase
    .from('citizens_assemblies')
    .insert({
      title,
      question,
      topic_id: body.topic_id ?? null,
      max_members: maxMembers,
      created_by: user.id,
      status: 'forming',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Convener joins as first member + chair
  await supabase.from('assembly_members').insert({
    assembly_id: (assembly as { id: string }).id,
    user_id: user.id,
    is_chair: true,
  })

  return NextResponse.json({ id: (assembly as { id: string }).id })
}
