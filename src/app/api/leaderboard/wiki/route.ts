import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiEditor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_edits: number
  topics_edited: number
  chars_added: number
  rank: number
}

export interface MostEditedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_edits: number
  unique_editors: number
  chars_added: number
  last_edited_at: string
  rank: number
}

export interface RecentWikiEdit {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  editor_id: string | null
  editor_username: string | null
  editor_display_name: string | null
  editor_avatar_url: string | null
  editor_role: string | null
  char_delta: number
  created_at: string
}

export interface WikiLeaderboardResponse {
  topEditors: WikiEditor[]
  mostEditedTopics: MostEditedTopic[]
  recentEdits: RecentWikiEdit[]
  stats: {
    total_edits: number
    total_editors: number
    total_topics_edited: number
    total_chars_added: number
    avg_chars_per_edit: number
  }
  generatedAt: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    // ── 1. Fetch all wiki edits with editor and topic info ────────────────────
    const { data: historyRows, error } = await supabase
      .from('topic_wiki_history')
      .select(`
        id,
        topic_id,
        editor_id,
        char_delta,
        created_at,
        topics (
          id,
          statement,
          category,
          status
        ),
        profiles!topic_wiki_history_editor_id_fkey (
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      `)
      .not('editor_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Wiki leaderboard error:', error)
      return NextResponse.json({ error: 'Failed to fetch wiki history' }, { status: 500 })
    }

    const rows = historyRows ?? []

    // ── 2. Aggregate per-editor stats ─────────────────────────────────────────
    const editorMap: Record<string, {
      user_id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      total_edits: number
      topics_edited: Set<string>
      chars_added: number
    }> = {}

    for (const row of rows) {
      const profile = (row as { profiles?: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number } | null }).profiles
      if (!profile || !row.editor_id) continue

      const uid = row.editor_id as string
      if (!editorMap[uid]) {
        editorMap[uid] = {
          user_id: uid,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          clout: profile.clout ?? 0,
          total_edits: 0,
          topics_edited: new Set(),
          chars_added: 0,
        }
      }
      editorMap[uid].total_edits++
      editorMap[uid].topics_edited.add(row.topic_id as string)
      if ((row.char_delta as number) > 0) {
        editorMap[uid].chars_added += row.char_delta as number
      }
    }

    const topEditors: WikiEditor[] = Object.values(editorMap)
      .sort((a, b) => b.total_edits - a.total_edits || b.chars_added - a.chars_added)
      .slice(0, 25)
      .map((e, i) => ({
        user_id: e.user_id,
        username: e.username,
        display_name: e.display_name,
        avatar_url: e.avatar_url,
        role: e.role,
        clout: e.clout,
        total_edits: e.total_edits,
        topics_edited: e.topics_edited.size,
        chars_added: e.chars_added,
        rank: i + 1,
      }))

    // ── 3. Aggregate per-topic stats ──────────────────────────────────────────
    const topicMap: Record<string, {
      id: string
      statement: string
      category: string | null
      status: string
      total_edits: number
      editors: Set<string>
      chars_added: number
      last_edited_at: string
    }> = {}

    for (const row of rows) {
      const topic = (row as { topics?: { id: string; statement: string; category: string | null; status: string } | null }).topics
      if (!topic) continue

      const tid = row.topic_id as string
      if (!topicMap[tid]) {
        topicMap[tid] = {
          id: tid,
          statement: topic.statement,
          category: topic.category,
          status: topic.status,
          total_edits: 0,
          editors: new Set(),
          chars_added: 0,
          last_edited_at: row.created_at as string,
        }
      }
      topicMap[tid].total_edits++
      if (row.editor_id) topicMap[tid].editors.add(row.editor_id as string)
      if ((row.char_delta as number) > 0) topicMap[tid].chars_added += row.char_delta as number
      if ((row.created_at as string) > topicMap[tid].last_edited_at) {
        topicMap[tid].last_edited_at = row.created_at as string
      }
    }

    const mostEditedTopics: MostEditedTopic[] = Object.values(topicMap)
      .sort((a, b) => b.total_edits - a.total_edits || b.editors.size - a.editors.size)
      .slice(0, 20)
      .map((t, i) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_edits: t.total_edits,
        unique_editors: t.editors.size,
        chars_added: t.chars_added,
        last_edited_at: t.last_edited_at,
        rank: i + 1,
      }))

    // ── 4. Recent edits ───────────────────────────────────────────────────────
    const recentEdits: RecentWikiEdit[] = rows.slice(0, 30).map((row) => {
      const topic = (row as { topics?: { id: string; statement: string; category: string | null; status: string } | null }).topics
      const profile = (row as { profiles?: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null }).profiles
      return {
        id: row.id as string,
        topic_id: row.topic_id as string,
        topic_statement: topic?.statement ?? 'Unknown topic',
        topic_category: topic?.category ?? null,
        topic_status: topic?.status ?? 'proposed',
        editor_id: row.editor_id as string | null,
        editor_username: profile?.username ?? null,
        editor_display_name: profile?.display_name ?? null,
        editor_avatar_url: profile?.avatar_url ?? null,
        editor_role: profile?.role ?? null,
        char_delta: (row.char_delta as number) ?? 0,
        created_at: row.created_at as string,
      }
    })

    // ── 5. Platform stats ─────────────────────────────────────────────────────
    const totalEdits = rows.length
    const totalEditors = Object.keys(editorMap).length
    const totalTopicsEdited = Object.keys(topicMap).length
    const totalCharsAdded = rows.reduce((sum, r) => sum + Math.max(0, (r.char_delta as number) ?? 0), 0)

    return NextResponse.json({
      topEditors,
      mostEditedTopics,
      recentEdits,
      stats: {
        total_edits: totalEdits,
        total_editors: totalEditors,
        total_topics_edited: totalTopicsEdited,
        total_chars_added: totalCharsAdded,
        avg_chars_per_edit: totalEdits > 0 ? Math.round(totalCharsAdded / totalEdits) : 0,
      },
      generatedAt: new Date().toISOString(),
    } satisfies WikiLeaderboardResponse)
  } catch (err) {
    console.error('Wiki leaderboard unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
