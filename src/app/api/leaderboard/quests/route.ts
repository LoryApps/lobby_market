import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestTrack = 'voter' | 'debater' | 'scholar' | 'builder'

export interface QuestLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  track_score: number
  is_me: boolean
}

export interface QuestTrackLeaderboard {
  track: QuestTrack
  label: string
  metric_label: string
  description: string
  entries: QuestLeaderEntry[]
  my_rank: number | null
  my_score: number | null
}

export interface QuestLeaderboardResponse {
  tracks: QuestTrackLeaderboard[]
  generated_at: string
}

// ─── Track configs ────────────────────────────────────────────────────────────

const TRACK_CONFIGS: {
  track: QuestTrack
  label: string
  metric_label: string
  description: string
  order_col: string
  min_col_value?: number
}[] = [
  {
    track: 'voter',
    label: 'Voter',
    metric_label: 'votes cast',
    description: 'Citizens who have cast the most votes across all topics',
    order_col: 'total_votes',
    min_col_value: 1,
  },
  {
    track: 'debater',
    label: 'Debater',
    metric_label: 'arguments written',
    description: 'Citizens who have contributed the most arguments to debates',
    order_col: 'total_arguments',
    min_col_value: 1,
  },
  {
    track: 'scholar',
    label: 'Scholar',
    metric_label: 'reputation score',
    description: 'Citizens with the highest civic reputation from quality engagement',
    order_col: 'reputation_score',
    min_col_value: 0.01,
  },
  {
    track: 'builder',
    label: 'Builder',
    metric_label: 'clout earned',
    description: 'Citizens who have built the most influence through civic leadership',
    order_col: 'clout',
    min_col_value: 1,
  },
]

const LIMIT = 50

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const tracks: QuestTrackLeaderboard[] = []

  for (const cfg of TRACK_CONFIGS) {
    const { data: rows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments')
      .gt(cfg.order_col, cfg.min_col_value ?? 0)
      .order(cfg.order_col, { ascending: false })
      .limit(LIMIT)

    const profiles = rows ?? []

    // Map to leaderboard entries with rank
    const entries: QuestLeaderEntry[] = profiles.map((p, i) => {
      let track_score = 0
      if (cfg.order_col === 'total_votes') track_score = p.total_votes
      else if (cfg.order_col === 'total_arguments') track_score = p.total_arguments
      else if (cfg.order_col === 'reputation_score') track_score = Math.round(p.reputation_score * 10) / 10
      else if (cfg.order_col === 'clout') track_score = p.clout

      return {
        rank: i + 1,
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout,
        track_score,
        is_me: user?.id === p.id,
      }
    })

    // Find the authenticated user's rank (may be outside top 50)
    let my_rank: number | null = null
    let my_score: number | null = null

    if (user) {
      const myEntry = entries.find((e) => e.user_id === user.id)
      if (myEntry) {
        my_rank = myEntry.rank
        my_score = myEntry.track_score
      } else {
        // User not in top 50 — fetch their actual stat
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('total_votes, total_arguments, reputation_score, clout')
          .eq('id', user.id)
          .maybeSingle()

        if (myProfile) {
          let score = 0
          if (cfg.order_col === 'total_votes') score = myProfile.total_votes
          else if (cfg.order_col === 'total_arguments') score = myProfile.total_arguments
          else if (cfg.order_col === 'reputation_score') score = Math.round(myProfile.reputation_score * 10) / 10
          else if (cfg.order_col === 'clout') score = myProfile.clout
          my_score = score

          // Count how many users have a higher score to determine rank
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gt(cfg.order_col, score)
          my_rank = (count ?? 0) + 1
        }
      }
    }

    tracks.push({
      track: cfg.track,
      label: cfg.label,
      metric_label: cfg.metric_label,
      description: cfg.description,
      entries,
      my_rank,
      my_score,
    })
  }

  return NextResponse.json({
    tracks,
    generated_at: new Date().toISOString(),
  } satisfies QuestLeaderboardResponse)
}
