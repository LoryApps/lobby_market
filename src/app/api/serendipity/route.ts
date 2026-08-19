import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SerendipityTopic {
  id: string
  statement: string
  category: string
  status: string
  blue_pct: number
  total_votes: number
  description: string | null
}

export interface SerendipityArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_statement: string
  topic_id: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

export interface SerendipityLaw {
  id: string
  statement: string
  category: string
  established_at: string
  total_votes: number
}

export interface SerendipityCitizen {
  username: string
  display_name: string | null
  avatar_url: string | null
  civic_archetype: string | null
  clout: number
  blue_lean: boolean
}

export interface SerendipityData {
  uncharted_topic: SerendipityTopic | null
  contrarian_argument: SerendipityArgument | null
  hidden_law: SerendipityLaw | null
  unexpected_citizen: SerendipityCitizen | null
  user_categories: string[]
  total_topics: number
}

const ALL_CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  'Justice', 'Foreign Policy', 'Society', 'Media', 'Sport',
]

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Get user's voting history by category ──────────────────────────────────

  const { data: votes } = await supabase
    .from('votes')
    .select('side, topics!inner(category)')
    .eq('user_id', user.id)

  // Tally which categories the user engages with
  const categoryVotes: Record<string, number> = {}
  let blueVotes = 0, redVotes = 0
  if (votes) {
    for (const v of votes) {
      const cat = (v.topics as { category: string } | null)?.category
      if (cat) categoryVotes[cat] = (categoryVotes[cat] ?? 0) + 1
      if (v.side === 'blue') blueVotes++
      else if (v.side === 'red') redVotes++
    }
  }

  const userCategories = Object.keys(categoryVotes).sort(
    (a, b) => (categoryVotes[b] ?? 0) - (categoryVotes[a] ?? 0)
  )

  // Categories with fewer than 2 votes are "uncharted"
  const unchartedCategories = ALL_CATEGORIES.filter(
    c => !categoryVotes[c] || (categoryVotes[c] ?? 0) < 2
  )

  // ── 1. Topic from an uncharted category ───────────────────────────────────

  let unchartedTopic: SerendipityTopic | null = null

  if (unchartedCategories.length > 0) {
    // Pick a random uncharted category
    const targetCat =
      unchartedCategories[Math.floor(Math.random() * unchartedCategories.length)]

    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, description')
      .eq('category', targetCat)
      .in('status', ['active', 'voting'])
      .gte('total_votes', 3)
      .order('total_votes', { ascending: false })
      .limit(10)

    if (topicRows && topicRows.length > 0) {
      const picked = topicRows[Math.floor(Math.random() * topicRows.length)]
      unchartedTopic = picked as unknown as SerendipityTopic
    }
  }

  // Fallback: any active topic (no filter by uncharted category)
  if (!unchartedTopic) {
    const { data: fallbackRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, description')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(20)

    if (fallbackRows && fallbackRows.length > 0) {
      // Pick from middle of list for variety
      const idx = Math.floor(Math.random() * Math.min(fallbackRows.length, 15))
      unchartedTopic = fallbackRows[idx] as unknown as SerendipityTopic
    }
  }

  // ── 2. Contrarian argument (opposite side to user's typical stance) ────────

  let contrarianArg: SerendipityArgument | null = null

  // User votes mostly blue? Show a red argument. And vice versa.
  const contrarianSide = blueVotes >= redVotes ? 'red' : 'blue'

  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select(
      'id, content, side, upvotes, topic_id, topics!inner(statement), profiles!inner(username, display_name, avatar_url)'
    )
    .eq('side', contrarianSide)
    .neq('user_id', user.id)
    .gte('upvotes', 2)
    .order('upvotes', { ascending: false })
    .limit(20)

  if (argRows && argRows.length > 0) {
    const picked = argRows[Math.floor(Math.random() * Math.min(argRows.length, 10))]
    const topic = picked.topics as unknown as { statement: string }
    const author = picked.profiles as unknown as {
      username: string
      display_name: string | null
      avatar_url: string | null
    }
    contrarianArg = {
      id: picked.id,
      content: picked.content,
      side: picked.side as 'blue' | 'red',
      upvotes: picked.upvotes ?? 0,
      topic_statement: topic?.statement ?? '',
      topic_id: picked.topic_id,
      author: {
        username: author?.username ?? '',
        display_name: author?.display_name ?? null,
        avatar_url: author?.avatar_url ?? null,
      },
    }
  }

  // ── 3. Hidden law the user likely missed ──────────────────────────────────

  let hiddenLaw: SerendipityLaw | null = null

  const lowEngageCats = unchartedCategories.length > 0 ? unchartedCategories : ALL_CATEGORIES

  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, total_votes')
    .in('category', lowEngageCats.slice(0, 8))
    .order('established_at', { ascending: false })
    .limit(20)

  if (lawRows && lawRows.length > 0) {
    const picked = lawRows[Math.floor(Math.random() * lawRows.length)]
    hiddenLaw = picked as unknown as SerendipityLaw
  }

  // Fallback: any recent law
  if (!hiddenLaw) {
    const { data: anyLaw } = await supabase
      .from('laws')
      .select('id, statement, category, established_at, total_votes')
      .order('established_at', { ascending: false })
      .limit(20)

    if (anyLaw && anyLaw.length > 0) {
      const picked = anyLaw[Math.floor(Math.random() * anyLaw.length)]
      hiddenLaw = picked as unknown as SerendipityLaw
    }
  }

  // ── 4. Unexpected citizen (different lean) ────────────────────────────────

  let unexpectedCitizen: SerendipityCitizen | null = null

  // Show a citizen with opposite vote lean
  const showBlueLean = redVotes > blueVotes

  const { data: citizenRows } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, civic_archetype, clout, blue_vote_count, red_vote_count')
    .neq('id', user.id)
    .not('username', 'is', null)
    .gte('clout', 10)
    .order('clout', { ascending: false })
    .limit(100)

  if (citizenRows && citizenRows.length > 0) {
    // Filter to opposite lean
    type CitizenRow = {
      username: string
      display_name: string | null
      avatar_url: string | null
      civic_archetype: string | null
      clout: number
      blue_vote_count: number
      red_vote_count: number
    }
    const filtered = (citizenRows as CitizenRow[]).filter(c => {
      if (showBlueLean) return c.blue_vote_count > c.red_vote_count
      return c.red_vote_count > c.blue_vote_count
    })

    const pool = filtered.length > 0 ? filtered : (citizenRows as CitizenRow[])
    const picked = pool[Math.floor(Math.random() * Math.min(pool.length, 20))]

    unexpectedCitizen = {
      username: picked.username,
      display_name: picked.display_name,
      avatar_url: picked.avatar_url,
      civic_archetype: picked.civic_archetype,
      clout: picked.clout,
      blue_lean: picked.blue_vote_count >= picked.red_vote_count,
    }
  }

  // ── Total topics count ────────────────────────────────────────────────────

  const { count: totalTopics } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json({
    uncharted_topic: unchartedTopic,
    contrarian_argument: contrarianArg,
    hidden_law: hiddenLaw,
    unexpected_citizen: unexpectedCitizen,
    user_categories: userCategories,
    total_topics: totalTopics ?? 0,
  } satisfies SerendipityData)
}
