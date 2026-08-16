import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

const VALID_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

export interface TopicMoodData {
  topic_id: string
  moods: { mood: MoodKind; count: number; pct: number }[]
  total: number
  user_mood: MoodKind | null
}

// ─── GET /api/topics/[id]/mood ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const [{ data: rows }, { data: userRow }] = await Promise.all([
      supabase
        .from('civic_topic_moods')
        .select('mood')
        .eq('topic_id', id),
      user
        ? supabase
            .from('civic_topic_moods')
            .select('mood')
            .eq('topic_id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const countMap: Record<string, number> = {}
    let total = 0
    for (const row of rows ?? []) {
      countMap[row.mood] = (countMap[row.mood] ?? 0) + 1
      total++
    }

    const moods = VALID_MOODS.map((mood) => ({
      mood,
      count: countMap[mood] ?? 0,
      pct: total > 0 ? Math.round(((countMap[mood] ?? 0) / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      topic_id: id,
      moods,
      total,
      user_mood: (userRow?.mood as MoodKind) ?? null,
    } satisfies TopicMoodData)
  } catch (err) {
    console.error('[GET /api/topics/[id]/mood]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// ─── POST /api/topics/[id]/mood ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const mood = body?.mood as string | undefined

    if (!mood || !VALID_MOODS.includes(mood as MoodKind)) {
      return NextResponse.json({ error: 'Invalid mood' }, { status: 400 })
    }

    // Verify topic exists
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Upsert: one mood per user per topic
    const { error } = await supabase
      .from('civic_topic_moods')
      .upsert(
        { user_id: user.id, topic_id: id, mood },
        { onConflict: 'user_id,topic_id' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true, mood })
  } catch (err) {
    console.error('[POST /api/topics/[id]/mood]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// ─── DELETE /api/topics/[id]/mood ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await supabase
      .from('civic_topic_moods')
      .delete()
      .eq('user_id', user.id)
      .eq('topic_id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/topics/[id]/mood]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
