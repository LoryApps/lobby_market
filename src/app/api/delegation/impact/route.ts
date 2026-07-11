import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface DelegationImpactResponse {
  platform: {
    total_active: number
    global_count: number
    category_count: number
    topic_count: number
    unique_delegators: number
    unique_delegates: number
    new_this_week: number
  }
  by_category: { category: string; count: number }[]
  top_delegates: {
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    total_count: number
    global_count: number
    category_count: number
    top_categories: string[]
  }[]
  recent_delegations: {
    delegator_username: string
    delegator_avatar: string | null
    delegate_username: string
    delegate_avatar: string | null
    scope: string
    created_at: string
  }[]
  my_stats: {
    given: number
    received: number
    given_global: number
    given_category: number
    given_topic: number
    top_category_trusted_in: string | null
  } | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Platform-wide totals ────────────────────────────────────────────────
  const { data: totals } = await supabase
    .from('vote_delegations')
    .select('id, topic_id, category, delegator_id, delegate_id, created_at', { count: 'exact' })
    .is('revoked_at', null)

  const active = totals ?? []
  const total_active = active.length
  const global_count = active.filter(r => !r.topic_id && !r.category).length
  const category_count = active.filter(r => r.category).length
  const topic_count = active.filter(r => r.topic_id).length
  const unique_delegators = new Set(active.map(r => r.delegator_id)).size
  const unique_delegates = new Set(active.map(r => r.delegate_id)).size
  const new_this_week = active.filter(r => r.created_at >= oneWeekAgo).length

  // ── 2. Category breakdown ─────────────────────────────────────────────────
  const categoryMap: Record<string, number> = {}
  for (const row of active) {
    if (row.category) {
      categoryMap[row.category] = (categoryMap[row.category] ?? 0) + 1
    }
  }
  const by_category = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }))

  // ── 3. Top delegates ──────────────────────────────────────────────────────
  const { data: statsRaw } = await supabase
    .from('delegation_stats')
    .select('delegate_id, global_count, category_count, topic_count, total_count')
    .gt('total_count', 0)
    .order('total_count', { ascending: false })
    .limit(10)

  const delegateIds = (statsRaw ?? []).map(r => r.delegate_id)
  const { data: delegateProfiles } = delegateIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', delegateIds)
    : { data: [] }

  const profileMap = Object.fromEntries((delegateProfiles ?? []).map(p => [p.id, p]))

  // Compute top categories per delegate from the active delegations
  const delegateCategoryMap: Record<string, Record<string, number>> = {}
  for (const row of active) {
    if (row.category) {
      if (!delegateCategoryMap[row.delegate_id]) delegateCategoryMap[row.delegate_id] = {}
      delegateCategoryMap[row.delegate_id][row.category] =
        (delegateCategoryMap[row.delegate_id][row.category] ?? 0) + 1
    }
  }

  const top_delegates = (statsRaw ?? []).map(stat => {
    const prof = profileMap[stat.delegate_id]
    const cats = delegateCategoryMap[stat.delegate_id] ?? {}
    const top_categories = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c)
    return {
      user_id: stat.delegate_id,
      username: prof?.username ?? stat.delegate_id,
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      role: prof?.role ?? 'person',
      clout: prof?.clout ?? 0,
      total_count: stat.total_count as number,
      global_count: stat.global_count as number,
      category_count: stat.category_count as number,
      top_categories,
    }
  })

  // ── 4. Recent delegations (last 20, public info only) ─────────────────────
  const { data: recentRaw } = await supabase
    .from('vote_delegations')
    .select(`
      topic_id, category, created_at,
      delegator:profiles!vote_delegations_delegator_id_fkey (username, avatar_url),
      delegate:profiles!vote_delegations_delegate_id_fkey (username, avatar_url)
    `)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const recent_delegations = (recentRaw ?? []).map(r => {
    const delegator = r.delegator as { username: string; avatar_url: string | null } | null
    const delegate = r.delegate as { username: string; avatar_url: string | null } | null
    let scope = 'Global'
    if (r.category) scope = r.category
    else if (r.topic_id) scope = 'Topic'
    return {
      delegator_username: delegator?.username ?? 'anonymous',
      delegator_avatar: delegator?.avatar_url ?? null,
      delegate_username: delegate?.username ?? 'anonymous',
      delegate_avatar: delegate?.avatar_url ?? null,
      scope,
      created_at: r.created_at as string,
    }
  })

  // ── 5. Personal stats for logged-in user ──────────────────────────────────
  let my_stats: DelegationImpactResponse['my_stats'] = null
  if (user) {
    const myGiven = active.filter(r => r.delegator_id === user.id)
    const myReceived = active.filter(r => r.delegate_id === user.id)
    const myReceivedCats = myReceived.filter(r => r.category)
    const catFreq: Record<string, number> = {}
    for (const r of myReceivedCats) {
      catFreq[r.category!] = (catFreq[r.category!] ?? 0) + 1
    }
    const top_category_trusted_in =
      Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    my_stats = {
      given: myGiven.length,
      received: myReceived.length,
      given_global: myGiven.filter(r => !r.topic_id && !r.category).length,
      given_category: myGiven.filter(r => r.category).length,
      given_topic: myGiven.filter(r => r.topic_id).length,
      top_category_trusted_in,
    }
  }

  const response: DelegationImpactResponse = {
    platform: {
      total_active,
      global_count,
      category_count,
      topic_count,
      unique_delegators,
      unique_delegates,
      new_this_week,
    },
    by_category,
    top_delegates,
    recent_delegations,
    my_stats,
  }

  return NextResponse.json(response)
}
