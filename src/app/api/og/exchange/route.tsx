import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// OG image for the Lobby Exchange landing page.
// Shows live market stats: total markets, daily volume, top mover, laws today.
export async function GET() {
  try {
    const supabase = await createClient()

    const [_statsRes, topMoverRes] = await Promise.all([
      supabase.rpc('get_exchange_overview_stats').maybeSingle().catch(() => ({ data: null })),
      supabase
        .from('topics')
        .select('statement, blue_pct, total_votes')
        .in('status', ['active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null })),
    ])

    // Fallback: compute stats directly if RPC not available
    const [activeRes, lawsTodayRes, totalVolumeRes] = await Promise.all([
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'voting']),
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'law')
        .gte('updated_at', new Date(Date.now() - 86_400_000).toISOString()),
      supabase
        .from('topics')
        .select('total_votes')
        .in('status', ['active', 'voting', 'law'])
        .limit(200),
    ])

    const liveMarkets = activeRes.count ?? 0
    const lawsToday = lawsTodayRes.count ?? 0
    const totalVolume = (totalVolumeRes.data ?? []).reduce(
      (sum, t) => sum + ((t.total_votes as number) ?? 0),
      0,
    )

    const topMarket = topMoverRes.data
    const topPrice = Math.round(topMarket?.blue_pct ?? 50)
    const topStatement = topMarket?.statement ?? null

    function formatVolume(n: number): string {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
      return n.toString()
    }

    const stats = [
      { label: 'LIVE MARKETS', value: liveMarkets.toLocaleString() },
      { label: 'TOTAL VOLUME', value: formatVolume(totalVolume) },
      { label: 'LAWS TODAY', value: lawsToday.toLocaleString() },
    ]

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0a0c11',
            padding: '60px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Grid lines */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${i * 126}px`,
                height: '1px',
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            />
          ))}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${i * 300}px`,
                width: '1px',
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            />
          ))}

          {/* Gold glow */}
          <div
            style={{
              position: 'absolute',
              top: '-180px',
              right: '-100px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 65%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-180px',
              left: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)',
            }}
          />

          {/* ── Branding ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
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
                letterSpacing: '0.22em',
              }}
            >
              LOBBY EXCHANGE
            </span>
          </div>

          {/* ── Headline ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '52px',
                fontWeight: 800,
                color: '#f1f5f9',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Trade the Civic
            </div>
            <div
              style={{
                fontSize: '52px',
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: '#c9a84c',
              }}
            >
              Consensus.
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 500,
                color: '#4b5563',
                marginTop: '8px',
                maxWidth: '620px',
                lineHeight: 1.5,
              }}
            >
              Every debate is a live market. Every vote moves the price.
              Consensus becomes law at 75¢.
            </div>
          </div>

          {/* ── Live stats bar ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '1px',
              marginTop: '32px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '24px',
            }}
          >
            {stats.map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingRight: i < stats.length - 1 ? '24px' : '0',
                  borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  marginRight: i < stats.length - 1 ? '24px' : '0',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#374151',
                    letterSpacing: '0.14em',
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#e2e8f0',
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </span>
              </div>
            ))}

            {/* Top market teaser */}
            {topStatement && (
              <div
                style={{
                  flex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingLeft: '24px',
                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                  marginLeft: '24px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#374151',
                    letterSpacing: '0.14em',
                  }}
                >
                  HOT MARKET
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      color: topPrice >= 67 ? '#c9a84c' : topPrice >= 55 ? '#3b82f6' : topPrice <= 33 ? '#ef4444' : '#94a3b8',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {topPrice}¢
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#6b7280',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      maxHeight: '40px',
                    }}
                  >
                    {topStatement.slice(0, 70)}{topStatement.length > 70 ? '…' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Domain */}
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              right: '60px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#1f2937',
              letterSpacing: '0.08em',
            }}
          >
            lobby.market/exchange
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
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '0.22em',
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
