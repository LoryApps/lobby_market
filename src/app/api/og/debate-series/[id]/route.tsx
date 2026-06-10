import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const FORMAT_LABEL: Record<string, string> = {
  best_of_3: 'BEST OF 3',
  best_of_5: 'BEST OF 5',
  best_of_7: 'BEST OF 7',
  fixed: 'FIXED',
}

const FORMAT_TOTAL: Record<string, number> = {
  best_of_3: 3,
  best_of_5: 5,
  best_of_7: 7,
  fixed: 0,
}

function fallback() {
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: series } = await supabase
      .from('debate_series')
      .select('title, description, format, status, blue_wins, red_wins, winner_side, topic_id')
      .eq('id', params.id)
      .single()

    if (!series) return fallback()

    const { data: topic } = series.topic_id
      ? await supabase
          .from('topics')
          .select('statement, category')
          .eq('id', series.topic_id)
          .single()
      : { data: null }

    const title = series.title ?? 'Untitled Series'
    const format = series.format ?? 'best_of_3'
    const status = series.status ?? 'ongoing'
    const blueWins = series.blue_wins ?? 0
    const redWins = series.red_wins ?? 0
    const winnerSide = series.winner_side ?? null
    const topicStatement = topic?.statement ?? null
    const category = topic?.category ?? null

    const formatLabel = FORMAT_LABEL[format] ?? format.toUpperCase()
    const totalRounds = FORMAT_TOTAL[format] || blueWins + redWins
    const isCompleted = status === 'completed'

    const statusColor = isCompleted ? '#c9a84c' : '#10b981'
    const statusLabel = isCompleted ? 'COMPLETED' : 'ONGOING'

    const titleFontSize = title.length > 80 ? 34 : title.length > 50 ? 40 : 46

    // Build score dot array
    const scoreDots: Array<'blue' | 'red' | 'empty'> = []
    for (let i = 0; i < totalRounds; i++) {
      if (i < blueWins) scoreDots.push('blue')
      else if (totalRounds - i <= redWins) scoreDots.push('red')
      else scoreDots.push('empty')
    }

    const winnerLabel =
      winnerSide === 'blue' ? 'FOR wins the series' : winnerSide === 'red' ? 'AGAINST wins the series' : null

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '56px 60px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Blue ambient glow — left side */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              left: '-120px',
              width: '520px',
              height: '520px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
            }}
          />
          {/* Red ambient glow — right side */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              right: '-120px',
              width: '520px',
              height: '520px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
            }}
          />
          {/* Gold glow — bottom center */}
          <div
            style={{
              position: 'absolute',
              bottom: '-160px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '600px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '32px',
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

            {/* Format + Status badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#1a1a22',
                  border: '1px solid #24242e',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9ca3af',
                  letterSpacing: '0.1em',
                }}
              >
                {formatLabel}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: `${statusColor}18`,
                  border: `1px solid ${statusColor}45`,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: statusColor,
                  letterSpacing: '0.12em',
                }}
              >
                {!isCompleted && (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: statusColor,
                    }}
                  />
                )}
                {statusLabel}
              </div>
            </div>
          </div>

          {/* Series label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                width: '3px',
                height: '20px',
                borderRadius: '2px',
                backgroundColor: '#c9a84c',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#c9a84c',
                letterSpacing: '0.12em',
              }}
            >
              DEBATE SERIES
            </span>
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: `${titleFontSize}px`,
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.25,
              maxWidth: '1020px',
              marginBottom: topicStatement ? '20px' : '32px',
            }}
          >
            {title}
          </div>

          {/* Topic reference */}
          {topicStatement && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#111117',
                border: '1px solid #24242e',
                maxWidth: '900px',
                marginBottom: '28px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#6b7280',
                  letterSpacing: '0.12em',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                ON
              </span>
              <span
                style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {topicStatement}
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Score section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            {/* Score labels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              {/* FOR score */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '48px',
                    fontWeight: 900,
                    color: winnerSide === 'blue' ? '#3b82f6' : '#60a5fa',
                    lineHeight: 1,
                  }}
                >
                  {blueWins}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#3b82f6',
                    letterSpacing: '0.12em',
                  }}
                >
                  FOR
                </span>
              </div>

              {/* VS divider */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#374151',
                  letterSpacing: '0.06em',
                }}
              >
                —
              </div>

              {/* AGAINST score */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '48px',
                    fontWeight: 900,
                    color: winnerSide === 'red' ? '#ef4444' : '#f87171',
                    lineHeight: 1,
                  }}
                >
                  {redWins}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ef4444',
                    letterSpacing: '0.12em',
                  }}
                >
                  AGAINST
                </span>
              </div>

              {/* Winner label */}
              {winnerLabel && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#c9a84c18',
                    border: '1px solid #c9a84c45',
                    marginLeft: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#c9a84c',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {winnerLabel.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Score dots */}
            {scoreDots.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {scoreDots.map((dot, i) => (
                  <div
                    key={i}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor:
                        dot === 'blue'
                          ? '#3b82f6'
                          : dot === 'red'
                          ? '#ef4444'
                          : '#1e2030',
                      border:
                        dot === 'empty'
                          ? '1px solid #2a2a38'
                          : 'none',
                      boxShadow:
                        dot === 'blue'
                          ? '0 0 8px rgba(59,130,246,0.6)'
                          : dot === 'red'
                          ? '0 0 8px rgba(239,68,68,0.6)'
                          : 'none',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              color: '#4b5563',
            }}
          >
            {category && (
              <span style={{ color: '#6b7280', marginRight: '14px' }}>{category}</span>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ color: '#374151', fontSize: '12px' }}>lobby.market</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
