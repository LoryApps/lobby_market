import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Deterministic palette for each tag (based on char code)
const PALETTES = [
  { accent: '#3b82f6', glow: 'rgba(59,130,246,0.18)', bg: 'rgba(59,130,246,0.10)' },  // blue
  { accent: '#ef4444', glow: 'rgba(239,68,68,0.15)',  bg: 'rgba(239,68,68,0.09)'  },  // red
  { accent: '#c9a84c', glow: 'rgba(201,168,76,0.18)', bg: 'rgba(201,168,76,0.10)' },  // gold
  { accent: '#10b981', glow: 'rgba(16,185,129,0.18)', bg: 'rgba(16,185,129,0.10)' },  // emerald
  { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.18)', bg: 'rgba(139,92,246,0.10)' },  // purple
]

function tagPalette(tag: string) {
  const code = tag.charCodeAt(0) + tag.charCodeAt(Math.min(2, tag.length - 1))
  return PALETTES[code % PALETTES.length]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  try {
    const tag = decodeURIComponent(params.tag)
    const supabase = await createClient()

    // Fetch tag stats
    const [topicsRes, lawsRes] = await Promise.all([
      supabase
        .from('topic_tags')
        .select('topic_id, topics!inner(status, category)')
        .eq('tag', tag)
        .limit(200),
      supabase
        .from('topic_tags')
        .select('topic_id, topics!inner(status)')
        .eq('tag', tag)
        .eq('topics.status', 'law')
        .limit(100),
    ])

    const taggedTopics = topicsRes.data ?? []
    const totalTopics = taggedTopics.length
    const totalLaws = lawsRes.data?.length ?? 0

    // Find the most common category
    const catCounts = new Map<string, number>()
    for (const row of taggedTopics) {
      const t = row.topics as { status: string; category: string | null } | null
      if (t?.category) catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1)
    }
    const topCategory = catCounts.size > 0
      ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null

    // Count active debates
    const activeCount = taggedTopics.filter((r) => {
      const t = r.topics as { status: string } | null
      return t?.status === 'active' || t?.status === 'voting' || t?.status === 'proposed'
    }).length

    const { accent, glow, bg } = tagPalette(tag)

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '60px 64px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Ambient glow top-center */}
          <div
            style={{
              position: 'absolute',
              top: '-160px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '600px',
              height: '500px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
            }}
          />

          {/* Faint grid lines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`,
              backgroundSize: '80px 80px',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '52px',
              position: 'relative',
            }}
          >
            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#c9a84c',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.18em',
                }}
              >
                LOBBY MARKET
              </span>
            </div>

            {/* Tag pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '100px',
                backgroundColor: bg,
                border: `1px solid ${accent}50`,
              }}
            >
              <span style={{ fontSize: '16px', color: accent, fontWeight: 700 }}>#</span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: '0.05em',
                }}
              >
                TAG
              </span>
            </div>
          </div>

          {/* Tag name — hero */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '20px',
              marginBottom: '44px',
              position: 'relative',
            }}
          >
            <span
              style={{
                fontSize: '80px',
                fontWeight: 900,
                color: accent,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                opacity: 0.35,
                flexShrink: 0,
                marginTop: '4px',
              }}
            >
              #
            </span>
            <span
              style={{
                fontSize: tag.length > 16 ? 56 : tag.length > 12 ? 68 : 80,
                fontWeight: 900,
                color: '#f1f5f9',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                textTransform: 'lowercase',
              }}
            >
              {tag}
            </span>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              position: 'relative',
            }}
          >
            {/* Total debates */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: `${accent}0d`,
                border: `1px solid ${accent}28`,
                minWidth: '160px',
              }}
            >
              <span
                style={{
                  fontSize: '42px',
                  fontWeight: 900,
                  color: accent,
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {totalTopics}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Debates
              </span>
            </div>

            {/* Active debates */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.22)',
                minWidth: '160px',
              }}
            >
              <span
                style={{
                  fontSize: '42px',
                  fontWeight: 900,
                  color: '#10b981',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {activeCount}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </span>
            </div>

            {/* Laws established */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.22)',
                minWidth: '160px',
              }}
            >
              <span
                style={{
                  fontSize: '42px',
                  fontWeight: 900,
                  color: '#c9a84c',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {totalLaws}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Laws
              </span>
            </div>

            {/* Top category */}
            {topCategory && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px 28px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(139,92,246,0.07)',
                  border: '1px solid rgba(139,92,246,0.22)',
                  minWidth: '160px',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 900,
                    color: '#8b5cf6',
                    lineHeight: 1,
                    marginBottom: '8px',
                  }}
                >
                  {topCategory}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Top category
                </span>
              </div>
            )}
          </div>

          {/* Bottom URL hint */}
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              right: '64px',
              fontSize: '13px',
              color: '#334155',
              letterSpacing: '0.04em',
            }}
          >
            lobby.market/tags/{tag}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch {
    return new Response('Failed to generate image', { status: 500 })
  }
}
