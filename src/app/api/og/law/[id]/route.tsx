import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: law } = await supabase
      .from('laws')
      .select('statement, category, total_votes, blue_pct, established_at')
      .eq('id', params.id)
      .single()

    const statement = law?.statement ?? 'Established Law'
    const forPct = Math.round(law?.blue_pct ?? 0)
    const againstPct = 100 - forPct
    const totalVotes = law?.total_votes ?? 0
    const category = law?.category ?? null
    const establishedDate = law?.established_at
      ? new Date(law.established_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null

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
          {/* Gold radial glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '520px',
              height: '520px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(201,168,76,0.13) 0%, transparent 70%)',
            }}
          />
          {/* Subtle emerald glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
            }}
          />
          {/* Fine top border line in gold */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background:
                'linear-gradient(90deg, transparent, #c9a84c, transparent)',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '36px',
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

            {/* LAW badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 16px',
                borderRadius: '6px',
                backgroundColor: 'rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.40)',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#c9a84c',
                }}
              />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.15em',
                }}
              >
                ESTABLISHED LAW
              </span>
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

          {/* Vote consensus bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '28px',
            }}
          >
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
                  background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                  borderRadius: '6px 0 0 6px',
                }}
              />
              <div
                style={{
                  width: `${againstPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                  borderRadius: '0 6px 6px 0',
                }}
              />
            </div>
          </div>

          {/* Footer */}
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
            {establishedDate && (
              <span style={{ marginLeft: '14px', color: '#374151' }}>
                · Established {establishedDate}
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
          LOBBY MARKET · LAW
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
