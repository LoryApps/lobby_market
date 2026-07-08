import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SIDE_LABEL: Record<string, string> = {
  for: 'FOR',
  against: 'AGAINST',
}

const SIDE_COLOR: Record<string, { primary: string; glow: string; bar: string }> = {
  for: {
    primary: '#3b82f6',
    glow: 'rgba(59,130,246,0.14)',
    bar: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
  },
  against: {
    primary: '#ef4444',
    glow: 'rgba(239,68,68,0.14)',
    bar: 'linear-gradient(90deg, #dc2626 0%, #f87171 100%)',
  },
}

const STATUS_LABEL: Record<string, string> = {
  open: 'OPEN · JOIN THE CHAIN',
  full: 'VOTING IN PROGRESS',
  complete: 'COMPLETED',
  voted: 'VERDICT IN',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: relay } = await supabase
      .from('civic_relays')
      .select('id, side, status, max_legs, topic_id')
      .eq('id', params.id)
      .single()

    if (!relay) throw new Error('relay not found')

    const [topicResult, legResult] = await Promise.all([
      relay.topic_id
        ? supabase
            .from('topics')
            .select('statement, category')
            .eq('id', relay.topic_id)
            .maybeSingle()
        : { data: null },
      supabase
        .from('relay_legs')
        .select('id', { count: 'exact' })
        .eq('relay_id', params.id),
    ])

    const topic = topicResult.data
    const legCount = legResult.count ?? 0
    const maxLegs = relay.max_legs ?? 5
    const side = relay.side ?? 'for'
    const sideLabel = SIDE_LABEL[side] ?? 'FOR'
    const colors = SIDE_COLOR[side] ?? SIDE_COLOR.for
    const status = relay.status ?? 'open'
    const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()

    const statement = topic?.statement ?? 'Civic Relay'
    const category = topic?.category ?? null
    const fontSize = statement.length > 100 ? 30 : statement.length > 60 ? 36 : 42

    // Chain dot indicators
    const dots = Array.from({ length: maxLegs }, (_, i) => ({
      filled: i < legCount,
    }))

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
            fontFamily: 'monospace',
          }}
        >
          {/* Ambient glow — side-colored */}
          <div
            style={{
              position: 'absolute',
              top: '-140px',
              right: '-140px',
              width: '520px',
              height: '520px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            }}
          />
          {/* Chain dots subtle background */}
          <div
            style={{
              position: 'absolute',
              bottom: '-60px',
              left: '-20px',
              width: '600px',
              height: '220px',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.02) 0%, transparent 70%)',
            }}
          />

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
            {/* LOBBY MARKET wordmark */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#4b5563',
                textTransform: 'uppercase',
              }}
            >
              LOBBY MARKET
            </span>

            <span style={{ color: '#1f2533', fontSize: '11px' }}>·</span>

            {/* CIVIC RELAY badge */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: '#6b7280',
                textTransform: 'uppercase',
              }}
            >
              CIVIC RELAY
            </span>

            <div style={{ flex: 1 }} />

            {/* Side pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 14px',
                borderRadius: '9999px',
                border: `1.5px solid ${colors.primary}`,
                background: `rgba(${side === 'for' ? '59,130,246' : '239,68,68'},0.12)`,
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: colors.primary,
                }}
              >
                {sideLabel}
              </span>
            </div>
          </div>

          {/* Topic statement */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            {category && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                }}
              >
                {category}
              </span>
            )}

            <p
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                color: '#f9fafb',
                lineHeight: 1.22,
                letterSpacing: '-0.01em',
                margin: 0,
                maxWidth: '900px',
              }}
            >
              {statement.length > 140 ? `${statement.slice(0, 137)}…` : statement}
            </p>
          </div>

          {/* Bottom section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '28px' }}>
            {/* Chain progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {dots.map((dot, i) => (
                <div
                  key={i}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: `2px solid ${dot.filled ? colors.primary : '#2d3748'}`,
                    background: dot.filled ? colors.primary : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: dot.filled ? '#fff' : '#4b5563',
                  }}
                >
                  {i + 1}
                </div>
              ))}
              <div style={{ flex: 1, height: '2px', background: '#1e2235', marginLeft: '4px' }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: '#6b7280',
                }}
              >
                {legCount}/{maxLegs} legs
              </span>
            </div>

            {/* Status + domain */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: status === 'open' ? colors.primary : '#6b7280',
                  textTransform: 'uppercase',
                }}
              >
                {statusLabel}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  color: '#374151',
                }}
              >
                lobby.market/relays
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
          LOBBY MARKET · CIVIC RELAY
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
