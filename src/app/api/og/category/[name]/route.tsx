import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CANONICAL_CATEGORIES: Record<string, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

const CATEGORY_PALETTE: Record<string, { accent: string; glow: string; bg: string }> = {
  Economics:   { accent: '#c9a84c', glow: 'rgba(201,168,76,0.20)',  bg: 'rgba(201,168,76,0.10)' },
  Politics:    { accent: '#3b82f6', glow: 'rgba(59,130,246,0.20)',  bg: 'rgba(59,130,246,0.10)' },
  Technology:  { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.20)',  bg: 'rgba(139,92,246,0.10)' },
  Science:     { accent: '#10b981', glow: 'rgba(16,185,129,0.20)',  bg: 'rgba(16,185,129,0.10)' },
  Ethics:      { accent: '#ef4444', glow: 'rgba(239,68,68,0.18)',   bg: 'rgba(239,68,68,0.09)'  },
  Philosophy:  { accent: '#60a5fa', glow: 'rgba(96,165,250,0.20)',  bg: 'rgba(96,165,250,0.10)' },
  Culture:     { accent: '#f59e0b', glow: 'rgba(245,158,11,0.20)',  bg: 'rgba(245,158,11,0.10)' },
  Health:      { accent: '#f87171', glow: 'rgba(248,113,113,0.20)', bg: 'rgba(248,113,113,0.10)' },
  Environment: { accent: '#34d399', glow: 'rgba(52,211,153,0.20)',  bg: 'rgba(52,211,153,0.10)' },
  Education:   { accent: '#a78bfa', glow: 'rgba(167,139,250,0.20)', bg: 'rgba(167,139,250,0.10)' },
}

const DEFAULT_PALETTE = { accent: '#3b82f6', glow: 'rgba(59,130,246,0.18)', bg: 'rgba(59,130,246,0.10)' }

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const slug = decodeURIComponent(params.name).toLowerCase()
    const categoryName = CANONICAL_CATEGORIES[slug]
    if (!categoryName) {
      return new Response('Unknown category', { status: 404 })
    }

    const supabase = await createClient()

    const { data: rows } = await supabase
      .from('topics')
      .select('status, total_votes')
      .eq('category', categoryName)
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])

    const allRows = rows ?? []
    const totalTopics = allRows.length
    const totalLaws = allRows.filter((t) => t.status === 'law').length
    const totalActive = allRows.filter(
      (t) => t.status === 'active' || t.status === 'voting'
    ).length
    const totalVotes = allRows.reduce((s, t) => s + (t.total_votes ?? 0), 0)

    const { accent, glow, bg } = CATEGORY_PALETTE[categoryName] ?? DEFAULT_PALETTE

    const voteLabel =
      totalVotes >= 1_000_000
        ? `${(totalVotes / 1_000_000).toFixed(1)}M`
        : totalVotes >= 1_000
        ? `${(totalVotes / 1_000).toFixed(1)}k`
        : String(totalVotes)

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
          {/* Ambient glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-200px',
              right: '-100px',
              width: '700px',
              height: '600px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
            }}
          />

          {/* Faint grid lines */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${accent}07 1px, transparent 1px), linear-gradient(90deg, ${accent}07 1px, transparent 1px)`,
              backgroundSize: '80px 80px',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '56px',
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

            {/* Category badge */}
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
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                }}
              >
                Category
              </span>
            </div>
          </div>

          {/* Category name — hero */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: '52px',
              position: 'relative',
            }}
          >
            {/* Accent bar */}
            <div
              style={{
                width: '48px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: accent,
              }}
            />
            <span
              style={{
                fontSize: categoryName.length > 10 ? 72 : 88,
                fontWeight: 900,
                color: '#f1f5f9',
                lineHeight: 1.0,
                letterSpacing: '-0.03em',
              }}
            >
              {categoryName}
            </span>
            <span
              style={{
                fontSize: '16px',
                color: '#475569',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              Browse proposals, active debates, and established laws
            </span>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              position: 'relative',
            }}
          >
            {/* Total topics */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: `${accent}0d`,
                border: `1px solid ${accent}28`,
                minWidth: '148px',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
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
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Topics
              </span>
            </div>

            {/* Active */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: 'rgba(16,185,129,0.07)',
                border: '1px solid rgba(16,185,129,0.22)',
                minWidth: '148px',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
                  fontWeight: 900,
                  color: '#10b981',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {totalActive}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </span>
            </div>

            {/* Laws */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.22)',
                minWidth: '148px',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
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
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Laws
              </span>
            </div>

            {/* Votes */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 28px',
                borderRadius: '16px',
                backgroundColor: 'rgba(139,92,246,0.07)',
                border: '1px solid rgba(139,92,246,0.22)',
                minWidth: '148px',
              }}
            >
              <span
                style={{
                  fontSize: '40px',
                  fontWeight: 900,
                  color: '#8b5cf6',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                {voteLabel}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Votes Cast
              </span>
            </div>
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
            lobby.market/categories/{slug}
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
