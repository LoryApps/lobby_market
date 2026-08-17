import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CensusSegment {
  label: string
  total: number        // total arguments written in this segment
  pct: number          // % of all arguments
  forArgs: number      // blue/FOR arguments
  againstArgs: number  // red/AGAINST arguments
  forPct: number       // % FOR within segment
  avgUpvotes: number   // average upvotes per argument
}

export interface CensusDimension {
  dimension: string   // 'role' | 'seniority' | 'clout' | 'activity'
  label: string       // Human-readable label
  segments: CensusSegment[]
}

export interface ArgumentCensusResponse {
  totalArguments: number
  uniqueAuthors: number
  overallForPct: number
  dimensions: CensusDimension[]
  // Top signals
  mostProductiveRole: string | null
  highestQualityRole: string | null  // by avg upvotes
  veteranForPct: number | null
  elderForPct: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seniorityBucket(createdAt: string): '< 1 month' | '1–6 months' | '6+ months' {
  const daysSince = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  if (daysSince < 30) return '< 1 month'
  if (daysSince < 180) return '1–6 months'
  return '6+ months'
}

function cloutBucket(clout: number): 'Emerging' | 'Established' | 'Influential' | 'Luminary' {
  if (clout < 100) return 'Emerging'
  if (clout < 500) return 'Established'
  if (clout < 2000) return 'Influential'
  return 'Luminary'
}

function activityBucket(totalVotes: number): 'New (< 10)' | 'Active (10–99)' | 'Veteran (100+)' {
  if (totalVotes < 10) return 'New (< 10)'
  if (totalVotes < 100) return 'Active (10–99)'
  return 'Veteran (100+)'
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

type RoleKey = 'person' | 'debator' | 'troll_catcher' | 'elder'
const ROLE_ORDER: RoleKey[] = ['person', 'debator', 'troll_catcher', 'elder']
const SENIORITY_ORDER = ['< 1 month', '1–6 months', '6+ months']
const CLOUT_ORDER = ['Emerging', 'Established', 'Influential', 'Luminary']
const ACTIVITY_ORDER = ['New (< 10)', 'Active (10–99)', 'Veteran (100+)']

function buildDimension(
  dimension: string,
  label: string,
  rows: Array<{
    bucketKey: string
    side: string
    upvotes: number
  }>,
  order: string[],
  totalArgs: number,
): CensusDimension {
  type BucketAcc = {
    total: number
    forArgs: number
    againstArgs: number
    totalUpvotes: number
  }
  const acc: Record<string, BucketAcc> = {}

  for (const r of rows) {
    if (!acc[r.bucketKey]) {
      acc[r.bucketKey] = { total: 0, forArgs: 0, againstArgs: 0, totalUpvotes: 0 }
    }
    acc[r.bucketKey].total++
    acc[r.bucketKey].totalUpvotes += r.upvotes
    if (r.side === 'blue') acc[r.bucketKey].forArgs++
    else acc[r.bucketKey].againstArgs++
  }

  const segments: CensusSegment[] = order
    .filter((key) => acc[key])
    .map((key) => {
      const b = acc[key]
      return {
        label: key,
        total: b.total,
        pct: totalArgs > 0 ? Math.round((b.total / totalArgs) * 100) : 0,
        forArgs: b.forArgs,
        againstArgs: b.againstArgs,
        forPct: b.total > 0 ? Math.round((b.forArgs / b.total) * 100) : 50,
        avgUpvotes: b.total > 0 ? Math.round((b.totalUpvotes / b.total) * 10) / 10 : 0,
      }
    })

  return { dimension, label, segments }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch up to 5000 recent arguments with author profile data
  const { data: argumentRows, error } = await supabase
    .from('arguments')
    .select(`
      id,
      side,
      upvotes,
      author_id,
      profiles!arguments_author_id_fkey (
        role,
        clout,
        total_votes,
        created_at
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error || !argumentRows) {
    return NextResponse.json({ error: 'Failed to load argument data' }, { status: 500 })
  }

  type ProfileRow = {
    role: string
    clout: number
    total_votes: number
    created_at: string
  }

  type ArgumentRow = {
    id: string
    side: string
    upvotes: number
    author_id: string
    profiles: ProfileRow | null
  }

  const rows = (argumentRows as unknown as ArgumentRow[]).filter(
    (r) => r.profiles != null
  )

  const totalArgs = rows.length
  const uniqueAuthors = new Set(rows.map((r) => r.author_id)).size
  const forTotal = rows.filter((r) => r.side === 'blue').length
  const overallForPct = totalArgs > 0 ? Math.round((forTotal / totalArgs) * 100) : 50

  // ── Role dimension ─────────────────────────────────────────────────────────
  const roleRows = rows.map((r) => ({
    bucketKey: ROLE_LABELS[r.profiles!.role] ?? r.profiles!.role,
    side: r.side,
    upvotes: r.upvotes,
  }))
  const roleDim = buildDimension(
    'role',
    'Civic Role',
    roleRows,
    ROLE_ORDER.map((k) => ROLE_LABELS[k] ?? k),
    totalArgs,
  )

  // ── Seniority dimension ────────────────────────────────────────────────────
  const seniorityRows = rows.map((r) => ({
    bucketKey: seniorityBucket(r.profiles!.created_at),
    side: r.side,
    upvotes: r.upvotes,
  }))
  const seniorityDim = buildDimension(
    'seniority',
    'Membership Seniority',
    seniorityRows,
    SENIORITY_ORDER,
    totalArgs,
  )

  // ── Clout dimension ────────────────────────────────────────────────────────
  const cloutRows = rows.map((r) => ({
    bucketKey: cloutBucket(r.profiles!.clout),
    side: r.side,
    upvotes: r.upvotes,
  }))
  const cloutDim = buildDimension(
    'clout',
    'Clout Standing',
    cloutRows,
    CLOUT_ORDER,
    totalArgs,
  )

  // ── Activity dimension ─────────────────────────────────────────────────────
  const activityRows = rows.map((r) => ({
    bucketKey: activityBucket(r.profiles!.total_votes),
    side: r.side,
    upvotes: r.upvotes,
  }))
  const activityDim = buildDimension(
    'activity',
    'Voting Activity',
    activityRows,
    ACTIVITY_ORDER,
    totalArgs,
  )

  // ── Summary signals ────────────────────────────────────────────────────────
  // Most productive role (most args written)
  const mostProductiveSeg = roleDim.segments.reduce(
    (best, seg) => (seg.total > (best?.total ?? -1) ? seg : best),
    null as CensusSegment | null,
  )

  // Highest quality role (highest avg upvotes, min 5 args)
  const qualitySeg = roleDim.segments
    .filter((s) => s.total >= 5)
    .reduce(
      (best, seg) => (seg.avgUpvotes > (best?.avgUpvotes ?? -1) ? seg : best),
      null as CensusSegment | null,
    )

  // Veteran FOR % (6+ months seniority)
  const veteranSeg = seniorityDim.segments.find((s) => s.label === '6+ months')
  const veteranForPct = veteranSeg ? veteranSeg.forPct : null

  // Elder FOR %
  const elderSeg = roleDim.segments.find((s) => s.label === 'Elder')
  const elderForPct = elderSeg ? elderSeg.forPct : null

  const response: ArgumentCensusResponse = {
    totalArguments: totalArgs,
    uniqueAuthors,
    overallForPct,
    dimensions: [roleDim, seniorityDim, cloutDim, activityDim],
    mostProductiveRole: mostProductiveSeg?.label ?? null,
    highestQualityRole: qualitySeg?.label ?? null,
    veteranForPct,
    elderForPct,
  }

  return NextResponse.json(response)
}
