import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_DEPARTMENTS = [
  'treasury','health','education','home-affairs','foreign-affairs',
  'environment','transport','housing','science','culture','justice','parliament','other',
] as const

const ALLOWED_CATEGORIES = [
  'Politics','Economics','Technology','Science','Ethics',
  'Philosophy','Culture','Health','Environment','Education','Other',
] as const

// ─── GET /api/ministerial-statements ─────────────────────────────────────────
// List recent statements with optional filters

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const department = searchParams.get('department')
  const type = searchParams.get('type') // oral | written
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('ministerial_statements')
    .select(`
      id, title, summary, body, department, category, statement_type,
      question_count, upvote_count, published_at, topic_id,
      minister:minister_id (
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (department) query = query.eq('department', department)
  if (type && (type === 'oral' || type === 'written')) query = query.eq('statement_type', type)

  const { data: statements, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch user's upvotes on these statements if logged in
  let userUpvotes: string[] = []
  if (user && statements && statements.length > 0) {
    const ids = statements.map((s: { id: string }) => s.id)
    const { data: votes } = await supabase
      .from('ministerial_statement_upvotes')
      .select('statement_id')
      .eq('user_id', user.id)
      .in('statement_id', ids)
    userUpvotes = votes?.map((v: { statement_id: string }) => v.statement_id) ?? []
  }

  return NextResponse.json({ statements: statements ?? [], userUpvotes, userId: user?.id ?? null })
}

// ─── POST /api/ministerial-statements ────────────────────────────────────────
// Create a new ministerial statement

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    title?: string
    body?: string
    summary?: string
    department?: string
    category?: string
    statement_type?: string
    topic_id?: string | null
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, body: bodyText, summary, department, category, statement_type, topic_id } = body

  if (!title || title.length < 10 || title.length > 200)
    return NextResponse.json({ error: 'Title must be 10–200 characters' }, { status: 400 })
  if (!bodyText || bodyText.length < 100 || bodyText.length > 5000)
    return NextResponse.json({ error: 'Statement body must be 100–5000 characters' }, { status: 400 })
  if (!department || !(ALLOWED_DEPARTMENTS as readonly string[]).includes(department))
    return NextResponse.json({ error: 'Invalid department' }, { status: 400 })
  if (category && !(ALLOWED_CATEGORIES as readonly string[]).includes(category))
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (statement_type && statement_type !== 'oral' && statement_type !== 'written')
    return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 })

  const { data: statement, error } = await supabase
    .from('ministerial_statements')
    .insert({
      minister_id:    user.id,
      title:          title.trim(),
      body:           bodyText.trim(),
      summary:        summary?.trim() ?? null,
      department:     department,
      category:       category ?? 'Politics',
      statement_type: statement_type ?? 'written',
      topic_id:       topic_id ?? null,
    })
    .select(`
      id, title, summary, department, statement_type, published_at,
      minister:minister_id (id, username, display_name, avatar_url, role)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ statement }, { status: 201 })
}
