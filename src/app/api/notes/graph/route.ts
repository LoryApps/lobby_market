import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NoteGraphNode {
  id: string
  type: 'note' | 'topic'
  label: string
  category: string | null
  pinned?: boolean
  status?: string
}

export interface NoteGraphLink {
  source: string
  target: string
}

export interface NoteGraphResponse {
  nodes: NoteGraphNode[]
  links: NoteGraphLink[]
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notes, error } = await supabase
    .from('civic_notes')
    .select(
      `id, title, content, pinned,
       topic:topics ( id, statement, category, status )`
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const nodeMap = new Map<string, NoteGraphNode>()
  const links: NoteGraphLink[] = []

  for (const note of (notes ?? []) as {
    id: string
    title: string
    content: string
    pinned: boolean
    topic: { id: string; statement: string; category: string | null; status: string } | null
  }[]) {
    const noteLabel = (note.title || note.content.slice(0, 40)).trim() || 'Untitled'
    nodeMap.set(note.id, {
      id: note.id,
      type: 'note',
      label: noteLabel,
      category: null,
      pinned: note.pinned,
    })

    if (note.topic) {
      const topicId = note.topic.id
      if (!nodeMap.has(topicId)) {
        nodeMap.set(topicId, {
          id: topicId,
          type: 'topic',
          label: note.topic.statement,
          category: note.topic.category,
          status: note.topic.status,
        })
      }
      links.push({ source: note.id, target: topicId })
    }
  }

  return NextResponse.json({
    nodes: Array.from(nodeMap.values()),
    links,
  } satisfies NoteGraphResponse)
}
