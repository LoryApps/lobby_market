import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/og/stance
 *
 * Generates a branded 1200×630 Open Graph image card for sharing a
 * user's vote stance on a topic.
 *
 * Query params:
 *   statement  – topic statement text
 *   side       – 'for' | 'against'
 *   pct        – integer 0-100, the FOR percentage of the vote
 *   votes      – total votes cast (integer)
 *   category   – optional category label
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const statement = searchParams.get('statement') ?? 'A topic on Lobby Market'
  const side = searchParams.get('side') === 'against' ? 'against' : 'for'
  const forPct = Math.max(0, Math.min(100, parseInt(searchParams.get('pct') ?? '50', 10) || 50))
  const againstPct = 100 - forPct
  const totalVotes = Math.max(0, parseInt(searchParams.get('votes') ?? '0', 10) || 0)
  const category = searchParams.get('category') ?? null

  const isFor = side === 'for'
  const voteLabel = isFor ? 'FOR' : 'AGAINST'
  const sideColor = isFor ? '#3b82f6' : '#ef4444'
  const sideBg = isFor ? 'rgba(59,130,246,0.09)' : 'rgba(239,68,68,0.09)'
  const sideBorder = isFor ? 'rgba(59,130,246,0.32)' : 'rgba(239,68,68,0.32)'
  const glowColor = isFor ? 'rgba(59,130,246,0.14)' : 'rgba(239,68,68,0.14)'

  // Shrink font for long statements
  const stmtFontSize = statement.length > 130 ? 30 : statement.length > 90 ? 36 : statement.length > 60 ? 42 : 48

  try {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '56px 64px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient glow — positioned behind content */}
          <div
            style={{
              position: 'absolute',
              top: isFor ? '-80px' : 'auto',
              bottom: isFor ? 'auto' : '-80px',
              right: isFor ? '-80px' : 'auto',
              left: isFor ? 'auto' : '-80px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 65%)`,
            }}
          />

          {/* Diagonal accent stripe (thin) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: isFor
                ? 'linear-gradient(90deg, transparent 0%, #2563eb 30%, #3b82f6 70%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, #dc2626 30%, #ef4444 70%, transparent 100%)',
            }}
          />

          {/* ── "I VOTED" badge ─────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '36px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 22px',
                borderRadius: '9999px',
                backgroundColor: sideBg,
                border: `1.5px solid ${sideBorder}`,
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                I voted
              </span>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: sideColor,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                {voteLabel}
              </span>
            </div>

            {category && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#4b5563',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {category}
              </span>
            )}
          </div>

          {/* ── Statement ──────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                fontSize: `${stmtFontSize}px`,
                fontWeight: 700,
                color: '#f0f0f5',
                lineHeight: 1.28,
                maxWidth: '1040px',
                margin: 0,
              }}
            >
              &ldquo;{statement}&rdquo;
            </p>
          </div>

          {/* ── Vote split ─────────────────────────────────────────── */}
          <div style={{ marginTop: '32px' }}>
            {/* Percentages row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#3b82f6',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  FOR
                </span>
                <span
                  style={{ fontSize: '36px', fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}
                >
                  {forPct}%
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#ef4444',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  AGAINST
                </span>
                <span
                  style={{ fontSize: '36px', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}
                >
                  {againstPct}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                display: 'flex',
                height: '12px',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#1a1a22',
              }}
            >
              {forPct > 0 && (
                <div
                  style={{
                    width: `${forPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%)',
                    borderRadius: againstPct > 0 ? '6px 0 0 6px' : '6px',
                  }}
                />
              )}
              {againstPct > 0 && (
                <div
                  style={{
                    width: `${againstPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
                    borderRadius: forPct > 0 ? '0 6px 6px 0' : '6px',
                  }}
                />
              )}
            </div>

            {/* Footer row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '14px',
                fontSize: '13px',
                color: '#4b5563',
              }}
            >
              {totalVotes > 0 && (
                <span>{totalVotes.toLocaleString()} votes cast</span>
              )}
              <div style={{ flex: 1 }} />
              <span style={{ color: '#52525b', letterSpacing: '0.04em', fontSize: '12px' }}>
                lobby.market
              </span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            color: '#c9a84c',
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          LOBBY MARKET
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
