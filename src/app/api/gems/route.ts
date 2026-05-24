import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GemTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  scope: string
  created_at: string
}

export interface GemArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface GemProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  total_arguments: number
  followers_count: number
  clout: number
  civic_archetype: string | null
}

export interface GemLaw {
  id: string
  statement: string
  category: string | null
  scope: string
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface GemsResponse {
  hiddenDebates: GemTopic[]
  risingArguments: GemArgument[]
  risingVoices: GemProfile[]
  quietLaws: GemLaw[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Topics that have quality arguments but fewer votes/views — "hidden debates"
const TOPIC_COLS = 'id, statement, category, status, blue_pct, total_votes, view_count, scope, created_at'

export async function GET() {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [topicsRes, argsRes, profilesRes, lawsRes] = await Promise.all([
    // Hidden debates: active/voting topics with moderate votes but good quality
    // (We look for topics with votes between 10–300 created in the last 30 days)
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .lte('total_votes', 300)
      .gte('created_at', thirtyDaysAgo)
      .order('total_votes', { ascending: false })
      .limit(60),

    // Rising arguments: high AI score or many upvotes but posted in last 7 days
    supabase
      .from('topic_arguments')
      .select(
        'id, content, side, upvotes, ai_score, ai_grade, created_at, topic_id, user_id, topics!inner(statement, category), profiles!inner(username, display_name, avatar_url)'
      )
      .gte('created_at', sevenDaysAgo)
      .gte('upvotes', 3)
      .order('upvotes', { ascending: false })
      .limit(40),

    // Rising voices: high reputation / argument quality but low follower count
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, total_arguments, followers_count, clout, civic_archetype')
      .gte('total_arguments', 5)
      .lte('followers_count', 50)
      .gte('reputation_score', 10)
      .order('reputation_score', { ascending: false })
      .limit(30),

    // Quiet laws: laws established in the last 60 days with fewer total votes
    supabase
      .from('topics')
      .select(TOPIC_COLS + ', updated_at')
      .eq('status', 'law')
      .lte('total_votes', 500)
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  const topics = (topicsRes.data ?? []) as Array<{ id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; view_count: number; scope: string; created_at: string }>
  const args = (argsRes.data ?? []) as Array<{
    id: string; content: string; side: string; upvotes: number; ai_score: number | null; ai_grade: string | null; created_at: string; topic_id: string; user_id: string;
    topics: { statement: string; category: string | null } | null;
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  }>
  const profiles = (profilesRes.data ?? []) as GemProfile[]
  const laws = (lawsRes.data ?? []) as Array<{ id: string; statement: string; category: string | null; scope: string; blue_pct: number; total_votes: number; updated_at: string }>

  // Sort topics by "gem score" — high support count relative to views + recency
  const hiddenDebates: GemTopic[] = topics
    .sort((a, b) => {
      const aScore = a.total_votes / Math.max(a.view_count, 1)
      const bScore = b.total_votes / Math.max(b.view_count, 1)
      return bScore - aScore
    })
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      view_count: t.view_count,
      scope: t.scope,
      created_at: t.created_at,
    }))

  const risingArguments: GemArgument[] = args
    .filter((a) => a.topics && a.profiles)
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      topic_id: a.topic_id,
      topic_statement: a.topics!.statement,
      topic_category: a.topics!.category,
      username: a.profiles!.username,
      display_name: a.profiles!.display_name,
      avatar_url: a.profiles!.avatar_url,
    }))

  const risingVoices: GemProfile[] = profiles.slice(0, 6)

  const quietLaws: GemLaw[] = laws.slice(0, 6).map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category,
    scope: l.scope,
    blue_pct: l.blue_pct,
    total_votes: l.total_votes,
    established_at: l.updated_at,
  }))

  return NextResponse.json({
    hiddenDebates,
    risingArguments,
    risingVoices,
    quietLaws,
  } satisfies GemsResponse)
}
