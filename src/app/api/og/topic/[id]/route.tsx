import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  proposed: 'PROPOSED',
  active: 'ACTIVE',
  voting: 'VOTING',
  law: 'ESTABLISHED LAW',
  failed: 'FAILED',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: '#6b7280',
  active: '#10b981',
  voting: '#f59e0b',
  law: '#c9a84c',
  failed: '#6b7280',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .single()

    const statement = topic?.statement ?? 'Untitled Topic'
    const forPct = Math.round(topic?.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const totalVotes = topic?.total_votes ?? 0
    const status = topic?.status ?? 'proposed'
    const category = topic?.category ?? null

    const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()
    const statusColor = STATUS_COLOR[status] ?? '#6b7280'

    // Dynamic font size based on statement length
    const fontSize =
      statement.length > 120 ? 32 : statement.length > 80 ? 38 : 44

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '60px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Ambient blue glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-120px',
              right: '-120px',
              width: '480px',
              height: '480px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
            }}
          />
          {/* Ambient red glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-120px',
              width: '480px',
              height: '480px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '40px',
            }}
          >
            {/* Wordmark */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
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
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.18em',
                }}
              >
                LOBBY MARKET
              </span>
            </div>

            {/* Status badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: `${statusColor}18`,
                border: `1px solid ${statusColor}45`,
                fontSize: '11px',
                fontWeight: 700,
                color: statusColor,
                letterSpacing: '0.12em',
              }}
            >
              {statusLabel}
            </div>
          </div>

          {/* Statement — grows to fill available space */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                color: '#f1f5f9',
                lineHeight: 1.3,
                maxWidth: '1060px',
              }}
            >
              {statement}
            </div>
          </div>

          {/* Vote bar section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '28px' }}>
            {/* Percentage labels */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: '#3b82f6',
                  }}
                >
                  {forPct}%
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#3b82f6',
                    opacity: 0.7,
                    letterSpacing: '0.12em',
                  }}
                >
                  FOR
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#ef4444',
                    opacity: 0.7,
                    letterSpacing: '0.12em',
                  }}
                >
                  AGAINST
                </span>
                <span
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: '#ef4444',
                  }}
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
                backgroundColor: '#1e2030',
              }}
            >
              <div
                style={{
                  width: `${forPct}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                  borderRadius: '6px 0 0 6px',
                }}
              />
              <div
                style={{
                  width: `${againstPct}%`,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                  borderRadius: '0 6px 6px 0',
                }}
              />
            </div>
          </div>

          {/* Footer stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '18px',
              fontSize: '13px',
              color: '#4b5563',
            }}
          >
            <span>{totalVotes.toLocaleString()} votes cast</span>
            {category && (
              <span style={{ marginLeft: '14px', color: '#374151' }}>
                · {category}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ color: '#374151', fontSize: '12px' }}>
              lobby.market
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    // Fallback image
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
