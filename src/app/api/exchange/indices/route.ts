import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IndexConstituent {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
}

export interface CivicIndex {
  id: string
  name: string
  description: string
  color: string                // Tailwind token for the index accent
  icon: string                 // lucide icon name
  composite_price: number      // volume-weighted average price (0–100)
  total_volume: number         // sum of constituent volumes
  market_count: number         // total markets in index
  active_count: number         // live + voting markets
  settled_yes_count: number    // markets that became law
  settled_no_count: number     // markets that failed
  direction: 'bull' | 'bear' | 'neutral'
  top_constituent: IndexConstituent | null
  constituents: IndexConstituent[]
}

export interface IndicesResponse {
  indices: CivicIndex[]
  as_of: string
}

// ─── Index definitions ────────────────────────────────────────────────────────

interface IndexDef {
  id: string
  name: string
  description: string
  color: string
  icon: string
  categories?: string[]
  filter?: 'near_law' | 'contested' | 'high_volume'
}

const INDEX_DEFS: IndexDef[] = [
  {
    id: 'economic-consensus',
    name: 'Economic Consensus',
    description: 'Aggregate civic agreement on fiscal, monetary, and trade policy across all economic debates.',
    color: 'gold',
    icon: 'TrendingUp',
    categories: ['Economics'],
  },
  {
    id: 'political-climate',
    name: 'Political Climate',
    description: 'How aligned is civic opinion on governance, elections, and democratic institutions?',
    color: 'for',
    icon: 'Landmark',
    categories: ['Politics'],
  },
  {
    id: 'digital-rights',
    name: 'Digital Rights',
    description: 'Consensus on technology regulation, AI policy, data privacy, and digital freedoms.',
    color: 'purple',
    icon: 'Cpu',
    categories: ['Technology'],
  },
  {
    id: 'green-agenda',
    name: 'Green Agenda',
    description: 'Environmental policy consensus — climate action, energy transition, and conservation.',
    color: 'emerald',
    icon: 'Leaf',
    categories: ['Environment'],
  },
  {
    id: 'public-health-index',
    name: 'Public Health Index',
    description: 'Healthcare, medical policy, and public health mandates consensus tracker.',
    color: 'emerald',
    icon: 'Heart',
    categories: ['Health'],
  },
  {
    id: 'ethics-commons',
    name: 'Ethics Commons',
    description: 'Moral and philosophical consensus on rights, justice, and the common good.',
    color: 'against',
    icon: 'Scale',
    categories: ['Ethics', 'Philosophy'],
  },
  {
    id: 'knowledge-society',
    name: 'Knowledge Society',
    description: 'Education policy, scientific consensus, and cultural debates shaping society.',
    color: 'for',
    icon: 'BookOpen',
    categories: ['Education', 'Science', 'Culture'],
  },
  {
    id: 'law-momentum',
    name: 'Law Momentum',
    description: 'Markets where civic consensus has reached or is approaching the 67% threshold for enactment.',
    color: 'gold',
    icon: 'Gavel',
    filter: 'near_law',
  },
  {
    id: 'contested-ground',
    name: 'Contested Ground',
    description: 'The most divided debates — markets locked between 40–60%, where every vote shifts the balance.',
    color: 'against',
    icon: 'Swords',
    filter: 'contested',
  },
]

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .not('status', 'in', '("proposed")')
      .order('total_votes', { ascending: false })

    if (error || !topics) {
      return NextResponse.json({ indices: [], as_of: new Date().toISOString() } satisfies IndicesResponse)
    }

    function buildIndex(def: IndexDef): CivicIndex {
      let pool = topics!

      if (def.categories) {
        pool = pool.filter((t) => def.categories!.includes(t.category ?? ''))
      }

      if (def.filter === 'near_law') {
        pool = pool.filter((t) => {
          const p = t.blue_pct ?? 50
          return p >= 60 || t.status === 'law'
        })
      } else if (def.filter === 'contested') {
        pool = pool.filter((t) => {
          const p = t.blue_pct ?? 50
          return p >= 40 && p <= 60 && t.status !== 'law' && t.status !== 'failed'
        })
      }

      const constituents: IndexConstituent[] = pool.map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        price: Math.round(t.blue_pct ?? 50),
        volume: t.total_votes ?? 0,
      }))

      const total_volume = constituents.reduce((s, c) => s + c.volume, 0)

      // Volume-weighted composite price
      let composite_price = 50
      if (total_volume > 0) {
        const weighted = constituents.reduce((s, c) => s + c.price * c.volume, 0)
        composite_price = Math.round(weighted / total_volume)
      } else if (constituents.length > 0) {
        composite_price = Math.round(
          constituents.reduce((s, c) => s + c.price, 0) / constituents.length,
        )
      }

      const active_count = constituents.filter(
        (c) => c.status === 'active' || c.status === 'voting',
      ).length
      const settled_yes_count = constituents.filter((c) => c.status === 'law').length
      const settled_no_count = constituents.filter((c) => c.status === 'failed').length

      let direction: CivicIndex['direction'] = 'neutral'
      if (composite_price >= 55) direction = 'bull'
      else if (composite_price <= 45) direction = 'bear'

      const top_constituent = constituents[0] ?? null

      // Limit constituents shown to top 8 by volume
      const topConstituents = constituents.slice(0, 8)

      return {
        id: def.id,
        name: def.name,
        description: def.description,
        color: def.color,
        icon: def.icon,
        composite_price,
        total_volume,
        market_count: constituents.length,
        active_count,
        settled_yes_count,
        settled_no_count,
        direction,
        top_constituent,
        constituents: topConstituents,
      }
    }

    const indices = INDEX_DEFS.map(buildIndex).filter((idx) => idx.market_count > 0)

    return NextResponse.json({
      indices,
      as_of: new Date().toISOString(),
    } satisfies IndicesResponse)
  } catch (err) {
    console.error('[/api/exchange/indices]', err)
    return NextResponse.json(
      { indices: [], as_of: new Date().toISOString() },
      { status: 500 },
    )
  }
}
