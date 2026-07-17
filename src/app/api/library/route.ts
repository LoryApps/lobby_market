import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Section limits ───────────────────────────────────────────────────────────

const WIKI_LIMIT = 12
const ARGUMENT_LIMIT = 12
const LAW_LIMIT = 8

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryWikiEntry {
  topicId: string
  statement: string
  category: string | null
  wiki: string
  wordCount: number
  bluePct: number
  totalVotes: number
  status: string
  updatedAt: string | null
  createdAt: string
}

export interface LibraryArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topicId: string
  topicStatement: string
  category: string | null
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  createdAt: string
}

export interface LibraryLaw {
  topicId: string
  statement: string
  category: string | null
  scope: string | null
  bluePct: number
  totalVotes: number
  establishedAt: string | null
  lawCode: string | null
}

export interface LibraryResponse {
  wikis: LibraryWikiEntry[]
  arguments: LibraryArgument[]
  laws: LibraryLaw[]
  stats: {
    totalWikis: number
    totalArguments: number
    totalLaws: number
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || null
  const q = searchParams.get('q')?.trim() || null
  const section = searchParams.get('section') || 'all'

  try {
    const [wikisResult, argsResult, lawsResult, statsResult] = await Promise.all([
      // ── Rich wiki articles ────────────────────────────────────────────────
      (section === 'all' || section === 'wikis')
        ? (async () => {
            let query = supabase
              .from('topics')
              .select(
                'id, statement, category, wiki, blue_pct, total_votes, status, updated_at, created_at'
              )
              .not('wiki', 'is', null)
              .not('wiki', 'eq', '')
              .order('updated_at', { ascending: false })
              .limit(WIKI_LIMIT * 3)

            if (category) query = query.eq('category', category)
            if (q) query = query.ilike('statement', `%${q}%`)

            const { data } = await query
            if (!data) return []

            // Score by wiki richness (word count) and activity
            return data
              .map((t) => ({
                topicId: t.id as string,
                statement: t.statement as string,
                category: t.category as string | null,
                wiki: (t.wiki as string) ?? '',
                wordCount: ((t.wiki as string) ?? '').split(/\s+/).filter(Boolean).length,
                bluePct: (t.blue_pct as number) ?? 50,
                totalVotes: (t.total_votes as number) ?? 0,
                status: t.status as string,
                updatedAt: t.updated_at as string | null,
                createdAt: t.created_at as string,
              }))
              .filter((e) => e.wordCount >= 30)
              .sort((a, b) => {
                const score = (x: typeof a) =>
                  Math.log1p(x.wordCount) * 0.6 + Math.log1p(x.totalVotes) * 0.4
                return score(b) - score(a)
              })
              .slice(0, WIKI_LIMIT)
          })()
        : Promise.resolve([]),

      // ── Top arguments ─────────────────────────────────────────────────────
      (section === 'all' || section === 'arguments')
        ? (async () => {
            const query = supabase
              .from('arguments')
              .select(
                `id, content, side, upvotes, topic_id, created_at,
                 topics!inner(statement, category),
                 profiles!inner(username, display_name, avatar_url)`
              )
              .gt('upvotes', 0)
              .order('upvotes', { ascending: false })
              .limit(ARGUMENT_LIMIT * 2)

            const { data } = await query
            if (!data) return []

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const entries: LibraryArgument[] = (data as any[]).map((a) => ({
              id: a.id as string,
              content: a.content as string,
              side: a.side as 'blue' | 'red',
              upvotes: (a.upvotes as number) ?? 0,
              topicId: a.topic_id as string,
              topicStatement: (a.topics?.statement ?? '') as string,
              category: (a.topics?.category ?? null) as string | null,
              authorUsername: (a.profiles?.username ?? null) as string | null,
              authorDisplayName: (a.profiles?.display_name ?? null) as string | null,
              authorAvatarUrl: (a.profiles?.avatar_url ?? null) as string | null,
              createdAt: a.created_at as string,
            }))

            if (category) {
              return entries.filter((e) => e.category === category).slice(0, ARGUMENT_LIMIT)
            }
            if (q) {
              const ql = q.toLowerCase()
              return entries
                .filter(
                  (e) =>
                    e.content.toLowerCase().includes(ql) ||
                    e.topicStatement.toLowerCase().includes(ql)
                )
                .slice(0, ARGUMENT_LIMIT)
            }
            return entries.slice(0, ARGUMENT_LIMIT)
          })()
        : Promise.resolve([]),

      // ── Established laws ──────────────────────────────────────────────────
      (section === 'all' || section === 'laws')
        ? (async () => {
            let query = supabase
              .from('topics')
              .select(
                'id, statement, category, scope, blue_pct, total_votes, created_at'
              )
              .eq('status', 'law')
              .order('created_at', { ascending: false })
              .limit(LAW_LIMIT * 2)

            if (category) query = query.eq('category', category)
            if (q) query = query.ilike('statement', `%${q}%`)

            const { data } = await query
            if (!data) return []

            // Also fetch law establishment dates
            const topicIds = data.map((t) => t.id as string)
            const { data: laws } = topicIds.length
              ? await supabase
                  .from('laws')
                  .select('topic_id, established_at, law_code')
                  .in('topic_id', topicIds)
              : { data: [] }

            const lawMap = new Map(
              (laws ?? []).map((l) => [
                l.topic_id as string,
                { established_at: l.established_at as string | null, law_code: l.law_code as string | null },
              ])
            )

            return data.slice(0, LAW_LIMIT).map((t) => ({
              topicId: t.id as string,
              statement: t.statement as string,
              category: t.category as string | null,
              scope: t.scope as string | null,
              bluePct: (t.blue_pct as number) ?? 50,
              totalVotes: (t.total_votes as number) ?? 0,
              establishedAt: lawMap.get(t.id as string)?.established_at ?? (t.created_at as string),
              lawCode: lawMap.get(t.id as string)?.law_code ?? null,
            }))
          })()
        : Promise.resolve([]),

      // ── Platform stats ────────────────────────────────────────────────────
      (async () => {
        const [wikiCount, argCount, lawCount] = await Promise.all([
          supabase
            .from('topics')
            .select('id', { count: 'exact', head: true })
            .not('wiki', 'is', null)
            .not('wiki', 'eq', ''),
          supabase
            .from('arguments')
            .select('id', { count: 'exact', head: true })
            .gt('upvotes', 0),
          supabase
            .from('topics')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'law'),
        ])
        return {
          totalWikis: wikiCount.count ?? 0,
          totalArguments: argCount.count ?? 0,
          totalLaws: lawCount.count ?? 0,
        }
      })(),
    ])

    const response: LibraryResponse = {
      wikis: wikisResult as LibraryWikiEntry[],
      arguments: argsResult as LibraryArgument[],
      laws: lawsResult as LibraryLaw[],
      stats: statsResult as { totalWikis: number; totalArguments: number; totalLaws: number },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/library]', err)
    return NextResponse.json(
      { error: 'Failed to load library' },
      { status: 500 }
    )
  }
}
