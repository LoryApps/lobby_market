import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return '#c9a84c'
  if (status === 'failed') return '#6b7280'
  if (price >= 67) return '#c9a84c'
  if (price >= 55) return '#3b82f6'
  if (price <= 33) return '#ef4444'
  if (price <= 45) return '#f87171'
  return '#94a3b8'
}

function priceBg(price: number, status: string): string {
  if (status === 'law') return 'rgba(201,168,76,0.12)'
  if (status === 'failed') return 'rgba(107,114,128,0.12)'
  if (price >= 67) return 'rgba(201,168,76,0.10)'
  if (price >= 55) return 'rgba(59,130,246,0.10)'
  if (price <= 33) return 'rgba(239,68,68,0.10)'
  if (price <= 45) return 'rgba(239,68,68,0.08)'
  return 'rgba(148,163,184,0.08)'
}

function deltaColor(delta: number | null): string {
  if (delta === null) return '#6b7280'
  if (delta > 0) return '#10b981'
  if (delta < 0) return '#ef4444'
  return '#6b7280'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    proposed: 'PROPOSED',
    active: 'ACTIVE',
    voting: 'VOTING',
    law: 'ESTABLISHED LAW',
    failed: 'FAILED',
  }
  return map[status] ?? status.toUpperCase()
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    proposed: '#6b7280',
    active: '#10b981',
    voting: '#f59e0b',
    law: '#c9a84c',
    failed: '#6b7280',
  }
  return map[status] ?? '#6b7280'
}

// Build a simple SVG sparkline path from price history points
function buildSparklinePath(
  points: number[],
  w: number,
  h: number,
): string {
  if (points.length < 2) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const xStep = w / (points.length - 1)
  return points
    .map((p, i) => {
      const x = Math.round(i * xStep)
      const y = Math.round(h - ((p - min) / range) * h)
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Fetch topic/market data in parallel
    const [topicRes, historyRes] = await Promise.all([
      supabase
        .from('topics')
        .select('statement, category, status, blue_pct, total_votes, feed_score')
        .eq('id', params.id)
        .single(),
      supabase
        .from('topic_price_history')
        .select('price, recorded_at')
        .eq('topic_id', params.id)
        .order('recorded_at', { ascending: true })
        .limit(30),
    ])

    const topic = topicRes.data
    const history = historyRes.data ?? []

    const statement = topic?.statement ?? 'Untitled Market'
    const price = Math.round(topic?.blue_pct ?? 50)
    const volume = topic?.total_votes ?? 0
    const status = topic?.status ?? 'active'
    const category = topic?.category ?? null

    // 24h price delta from history
    const recentHistory = history.filter(
      (h) =>
        new Date(h.recorded_at).getTime() > Date.now() - 24 * 60 * 60 * 1000,
    )
    const openPrice =
      recentHistory.length > 0
        ? Math.round(recentHistory[0].price)
        : price
    const delta24h = price - openPrice
    const allPrices = history.map((h) => h.price)
    if (allPrices.length === 0) allPrices.push(price)

    // Signals
    const isNearLaw = status === 'active' && price >= 75
    const isContested = price >= 42 && price <= 58
    const isNearFailure = status === 'active' && price <= 25

    // Text sizing
    const fontSize =
      statement.length > 120 ? 30 : statement.length > 80 ? 36 : 42

    const col = priceColor(price, status)
    const bg = priceBg(price, status)
    const dCol = deltaColor(delta24h)
    const sColor = statusColor(status)
    const sLabel = statusLabel(status)

    // Sparkline SVG
    const SW = 220
    const SH = 60
    const sparkPath = buildSparklinePath(allPrices, SW, SH)
    const sparkColor =
      allPrices[allPrices.length - 1] >= allPrices[0]
        ? '#10b981'
        : '#ef4444'

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0a0c11',
            padding: '56px 60px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Grid lines — subtle Bloomberg aesthetic */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i + 1) * 126}px`,
                height: '1px',
                backgroundColor: 'rgba(255,255,255,0.025)',
              }}
            />
          ))}

          {/* Ambient price glow */}
          <div
            style={{
              position: 'absolute',
              top: '-200px',
              right: '-100px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${col}16 0%, transparent 65%)`,
            }}
          />

          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '36px',
            }}
          >
            {/* Branding */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#c9a84c',
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.22em',
                }}
              >
                LOBBY EXCHANGE
              </span>
            </div>

            {/* Status + Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {category && (
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    letterSpacing: '0.10em',
                  }}
                >
                  {category.toUpperCase()}
                </div>
              )}
              <div
                style={{
                  padding: '4px 12px',
                  borderRadius: '5px',
                  backgroundColor: `${sColor}18`,
                  border: `1px solid ${sColor}40`,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: sColor,
                  letterSpacing: '0.12em',
                }}
              >
                {sLabel}
              </div>
            </div>
          </div>

          {/* ── Statement ── */}
          <div
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: 700,
              color: '#e2e8f0',
              lineHeight: 1.28,
              maxWidth: '820px',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {statement.length > 150
              ? statement.slice(0, 147) + '…'
              : statement}
          </div>

          {/* ── Market data row ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: '32px',
            }}
          >
            {/* Left: Price block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '4px',
                    padding: '10px 24px',
                    borderRadius: '10px',
                    backgroundColor: bg,
                    border: `1px solid ${col}30`,
                  }}
                >
                  <span
                    style={{
                      fontSize: '64px',
                      fontWeight: 800,
                      color: col,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {price}
                  </span>
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 600,
                      color: col,
                      opacity: 0.7,
                      lineHeight: 1,
                    }}
                  >
                    ¢
                  </span>
                </div>

                {/* 24h delta */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: dCol,
                      lineHeight: 1,
                    }}
                  >
                    {delta24h > 0 ? '+' : ''}{delta24h}¢
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#4b5563',
                      letterSpacing: '0.10em',
                    }}
                  >
                    24H CHANGE
                  </span>
                </div>
              </div>

              {/* Volume + signals */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4b5563',
                    letterSpacing: '0.08em',
                  }}
                >
                  VOL {formatVolume(volume)} VOTES
                </span>
                {isNearLaw && (
                  <div
                    style={{
                      padding: '3px 9px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(201,168,76,0.12)',
                      border: '1px solid rgba(201,168,76,0.30)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#c9a84c',
                      letterSpacing: '0.10em',
                    }}
                  >
                    NEAR LAW
                  </div>
                )}
                {isContested && (
                  <div
                    style={{
                      padding: '3px 9px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(139,92,246,0.12)',
                      border: '1px solid rgba(139,92,246,0.30)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#a78bfa',
                      letterSpacing: '0.10em',
                    }}
                  >
                    CONTESTED
                  </div>
                )}
                {isNearFailure && (
                  <div
                    style={{
                      padding: '3px 9px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.30)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#f87171',
                      letterSpacing: '0.10em',
                    }}
                  >
                    NEAR FAILURE
                  </div>
                )}
              </div>
            </div>

            {/* Right: Sparkline chart */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '6px',
              }}
            >
              {sparkPath && (
                <svg
                  width={SW}
                  height={SH}
                  viewBox={`0 0 ${SW} ${SH}`}
                  style={{ overflow: 'visible' }}
                >
                  {/* Area fill */}
                  <path
                    d={`${sparkPath} L${SW},${SH} L0,${SH} Z`}
                    fill={sparkColor}
                    fillOpacity="0.12"
                  />
                  {/* Line */}
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke={sparkColor}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#374151',
                  letterSpacing: '0.10em',
                }}
              >
                PRICE HISTORY
              </span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* FOR/AGAINST bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                  }}
                />
                <span
                  style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6' }}
                >
                  {price}% FOR
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                  }}
                />
                <span
                  style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444' }}
                >
                  {100 - price}% AGAINST
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                letterSpacing: '0.08em',
              }}
            >
              lobby.market/exchange
            </span>
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
            backgroundColor: '#0a0c11',
            color: '#c9a84c',
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontFamily: 'monospace',
          }}
        >
          LOBBY EXCHANGE
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
