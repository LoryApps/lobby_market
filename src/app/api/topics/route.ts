import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndGrantAchievements } from '@/lib/achievements'

const CATEGORIES = [
  'Politics',
  'Technology',
  'Ethics',
  'Culture',
  'Economics',
  'Science',
  'Philosophy',
  'Other',
]

const SCOPES = ['Global', 'National', 'Regional', 'Local']

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { statement?: string; description?: string; category?: string; scope?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { statement, description, category, scope } = body

  // Validate statement
  if (!statement || typeof statement !== 'string' || statement.trim().length === 0) {
    return NextResponse.json(
      { error: 'Statement is required' },
      { status: 400 }
    )
  }

  if (statement.length > 280) {
    return NextResponse.json(
      { error: 'Statement must be 280 characters or fewer' },
      { status: 400 }
    )
  }

  // Validate optional description
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return NextResponse.json({ error: 'Invalid description' }, { status: 400 })
    }
    if (description.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Description must be 2000 characters or fewer' },
        { status: 400 }
      )
    }
  }

  // Validate category
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: 'Invalid category' },
      { status: 400 }
    )
  }

  // Validate scope
  if (scope && !SCOPES.includes(scope)) {
    return NextResponse.json(
      { error: 'Invalid scope' },
      { status: 400 }
    )
  }

  // Insert topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .insert({
      author_id: user.id,
      statement: statement.trim(),
      description: description?.trim() || null,
      category: category || null,
      scope: scope || 'Global',
      status: 'proposed',
    })
    .select()
    .single()

  if (topicError) {
    return NextResponse.json(
      { error: 'Failed to create topic' },
      { status: 500 }
    )
  }

  // Auto-support: author supports their own topic
  await supabase.from('topic_supports').insert({
    user_id: user.id,
    topic_id: topic.id,
  })

  // Check and grant achievements in the background
  checkAndGrantAchievements(user.id, supabase).catch(() => {/* best-effort */})

  return NextResponse.json(topic, { status: 201 })
}
