import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function todayKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function dayHash(dateKey: string, n: number): number {
  let h = 0
  for (let i = 0; i < dateKey.length; i++) {
    h = (h * 31 + dateKey.charCodeAt(i)) >>> 0
  }
  return h % n
}

function scoreThesis(t: {
  agree_count: number
  disagree_count: number
  rationale: string | null
  related_topic_id: string | null
  created_at: string
}): number {
  const total = t.agree_count + t.disagree_count
  if (total < 2) return 0
  const agreePct = t.agree_count / total
  const contestScore = 1 - Math.abs(agreePct - 0.5) * 2
  const engagementScore = Math.log1p(total) / Math.log1p(100)
  const qualityBonus = (t.rationale ? 0.2 : 0) + (t.related_topic_id ? 0.1 : 0)
  const ageMs = Date.now() - new Date(t.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const recencyScore = Math.max(0, 1 - ageDays / 60)
  return contestScore * 0.4 + engagementScore * 0.3 + qualityBonus * 0.1 + recencyScore * 0.2
}

const CATEGORY_COLOR: Record<string, string> = {
  economics:   '#f59e0b',
  politics:    '#60a5fa',
  technology:  '#a855f7',
  science:     '#10b981',
  ethics:      '#f87171',
  philosophy:  '#94a3b8',
  culture:     '#fb923c',
  health:      '#34d399',
  environment: '#6ee7b7',
  education:   '#93c5fd',
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ color: '#f59e0b', fontSize: '32px' }}>★</div>
          <span style={{ color: '#f59e0b', fontSize: '18px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Thesis of the Day
          </span>
        </div>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.05em' }}>
          LOBBY MARKET
        </span>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const dateKey = todayKey()
    const thirtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    const { data: rows } = await supabase
      .from('civic_theses')
      .select('id, statement, rationale, category, agree_count, disagree_count, related_topic_id, created_at, user_id')
      .eq('status', 'active')
      .eq('is_public', true)
      .gte('created_at', thirtyDaysAgo)
      .gte('agree_count', 1)
      .order('agree_count', { ascending: false })
      .limit(50)

    if (!rows || rows.length === 0) return fallback()

    const scored = rows
      .map((r) => ({ row: r, score: scoreThesis(r) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) return fallback()

    const topN = Math.min(10, scored.length)
    const selected = scored[dayHash(dateKey, topN)].row

    // Fetch author
    const { data: author } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', selected.user_id)
      .maybeSingle()

    const statement = selected.statement ?? ''
    const fontSize = statement.length > 180 ? 24 : statement.length > 100 ? 32 : 40
    const total = selected.agree_count + selected.disagree_count
    const agreePct = total > 0 ? Math.round((selected.agree_count / total) * 100) : 50
    const catColor = CATEGORY_COLOR[selected.category] ?? '#60a5fa'
    const authorName = author?.display_name ?? author?.username ?? 'Anonymous'
    const category = selected.category.charAt(0).toUpperCase() + selected.category.slice(1)

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '0',
          }}
        >
          {/* Top gold accent bar */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, #f59e0b, #d97706, transparent)', display: 'flex' }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 64px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#f59e0b', fontSize: '20px' }}>★</span>
                <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  Thesis of the Day
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: catColor + '20', border: `1px solid ${catColor}40`, borderRadius: '20px', padding: '4px 12px' }}>
                  <span style={{ color: catColor, fontSize: '13px', fontWeight: 600 }}>{category}</span>
                </div>
                <span style={{ color: '#374151', fontSize: '13px' }}>{dateKey}</span>
              </div>
            </div>

            {/* Statement */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{
                color: '#f9fafb',
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: '24px',
              }}>
                &ldquo;{statement}&rdquo;
              </div>

              <div style={{ color: '#6b7280', fontSize: '18px', fontStyle: 'italic' }}>
                — {authorName}
              </div>
            </div>

            {/* Footer: vote bar + site */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{agreePct}% agree</span>
                  <span style={{ color: '#4b5563' }}>·</span>
                  <span style={{ color: '#9ca3af' }}>{total.toLocaleString()} votes</span>
                  <span style={{ color: '#4b5563' }}>·</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{100 - agreePct}% disagree</span>
                </div>
                {/* Vote bar */}
                <div style={{ width: '300px', height: '6px', background: '#1f2937', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${agreePct}%`, background: '#10b981', height: '100%' }} />
                  <div style={{ width: `${100 - agreePct}%`, background: '#ef4444', height: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#374151', fontSize: '14px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Lobby Market
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  } catch {
    return fallback()
  }
}
