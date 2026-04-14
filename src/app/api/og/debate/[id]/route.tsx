import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'SCHEDULED',
  live: 'LIVE NOW',
  ended: 'ENDED',
  cancelled: 'CANCELLED',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#f59e0b',
  live: '#10b981',
  ended: '#6b7280',
  cancelled: '#6b7280',
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
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

    const { data: debate } = await supabase
      .from('debates')
      .select('title, description, type, status, viewer_count, blue_sway, red_sway, scheduled_at, topic_id')
      .eq('id', params.id)
      .single()

    if (!debate) return fallback()

    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', debate.topic_id)
      .single()

    const { count: participantCount } = await supabase
      .from('debate_participants')
      .select('id', { count: 'exact', head: true })
      .eq('debate_id', params.id)

    const title = debate.title ?? 'Untitled Debate'
    const topicStatement = topic?.statement ?? null
    const category = topic?.category ?? null
    const status = debate.status ?? 'scheduled'
    const debateType = debate.type ?? 'oxford'
    const viewerCount = debate.viewer_count ?? 0
    const participants = participantCount ?? 0
    const blueSway = Math.round(debate.blue_sway ?? 0)
    const redSway = Math.round(debate.red_sway ?? 0)

    const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()
    const statusColor = STATUS_COLOR[status] ?? '#6b7280'
    const typeLabel = TYPE_LABEL[debateType] ?? debateType

    const isLive = status === 'live'
    const hasEnded = status === 'ended'

    // Format scheduled date
    const scheduledDate = debate.scheduled_at
      ? new Date(debate.scheduled_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null

    const titleFontSize = title.length > 80 ? 34 : title.length > 50 ? 40 : 46

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
          {/* Ambient gold glow top-center (debate = gold/amber theme) */}
          <div
            style={{
              position: 'absolute',
              top: '-160px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '600px',
              height: '400px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
            }}
          />
          {/* Blue glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
            }}
          />
          {/* Red glow bottom-right */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              right: '-100px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)',
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

            {/* Type + Status badges */}
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
                {typeLabel.toUpperCase()}
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
                {isLive && (
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

          {/* Microphone icon + debate type label */}
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
                backgroundColor: '#f59e0b',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#f59e0b',
                letterSpacing: '0.12em',
              }}
            >
              DEBATE
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
              marginBottom: topicStatement ? '20px' : '0',
            }}
          >
            {title}
          </div>

          {/* Topic reference (if available) */}
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

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Sway bar (if debate has ended or is live and has sway data) */}
          {hasEnded && (blueSway > 0 || redSway > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span style={{ color: '#3b82f6' }}>+{blueSway} FOR sway</span>
                <span style={{ color: '#ef4444' }}>+{redSway} AGAINST sway</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  backgroundColor: '#1e2030',
                }}
              >
                {(() => {
                  const total = blueSway + redSway || 1
                  const bluePct = Math.round((blueSway / total) * 100)
                  const redPct = 100 - bluePct
                  return (
                    <>
                      <div
                        style={{
                          width: `${bluePct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)',
                          borderRadius: '4px 0 0 4px',
                        }}
                      />
                      <div
                        style={{
                          width: `${redPct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                          borderRadius: '0 4px 4px 0',
                        }}
                      />
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              color: '#4b5563',
              gap: '0',
            }}
          >
            {participants > 0 && (
              <span style={{ marginRight: '14px', color: '#6b7280' }}>
                {participants} {participants === 1 ? 'speaker' : 'speakers'}
              </span>
            )}
            {isLive && viewerCount > 0 && (
              <span style={{ marginRight: '14px', color: '#6b7280' }}>
                · {viewerCount.toLocaleString()} watching
              </span>
            )}
            {!isLive && scheduledDate && !hasEnded && (
              <span style={{ color: '#6b7280' }}>
                {scheduledDate}
              </span>
            )}
            {category && (
              <span style={{ color: '#374151', marginLeft: '14px' }}>
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
    return fallback()
  }
}
