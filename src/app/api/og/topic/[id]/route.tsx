import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  proposed: 'PROPOSED',
  active: 'ACTIVE',
  voting: 'VOTING',
  law: 'NOW LAW',
  failed: 'FAILED',
}

const STATUS_COLORS: Record<string, string> = {
  proposed: '#71717a',
  active: '#3b82f6',
  voting: '#f59e0b',
  law: '#10b981',
  failed: '#ef4444',
}

function fallback() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>
          LOBBY MARKET
        </span>
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
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .single()

    if (!topic) return fallback()

    const forPct = Math.round(topic.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const votes = topic.total_votes ?? 0
    const status = topic.status ?? 'active'
    const statusColor = STATUS_COLORS[status] ?? '#71717a'
    const statusLabel = STATUS_LABELS[status] ?? status.toUpperCase()
    const statement = topic.statement ?? ''
    const fontSize = statement.length > 120 ? 30 : statement.length > 80 ? 38 : 46

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            padding: '64px 72px 60px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* Background glow */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '52px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  display: 'flex',
                }}
              />
              <span style={{ color: '#fafafa', fontSize: '17px', fontWeight: 700, letterSpacing: '0.18em' }}>
                LOBBY MARKET
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {topic.category && (
                <div
                  style={{
                    background: '#1a1a22',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #24242e',
                  }}
                >
                  {topic.category}
                </div>
              )}
              <div
                style={{
                  background: statusColor + '22',
                  color: statusColor,
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: `1px solid ${statusColor}44`,
                  letterSpacing: '0.08em',
                }}
              >
                {statusLabel}
              </div>
            </div>
          </div>

          {/* Statement */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p
              style={{
                color: '#fafafa',
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                lineHeight: 1.35,
                margin: 0,
                maxWidth: '980px',
              }}
            >
              {statement}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: '#24242e', marginBottom: '28px', marginTop: '32px' }} />

          {/* Vote bar + labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                height: '10px',
                borderRadius: '5px',
                overflow: 'hidden',
                background: '#1a1a22',
              }}
            >
              <div style={{ width: `${forPct}%`, background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', height: '100%' }} />
              <div style={{ width: `${againstPct}%`, background: 'linear-gradient(90deg, #ef4444, #b91c1c)', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '28px' }}>
                <span style={{ color: '#60a5fa', fontSize: '24px', fontWeight: 800 }}>{forPct}% For</span>
                <span style={{ color: '#f87171', fontSize: '24px', fontWeight: 800 }}>{againstPct}% Against</span>
              </div>
              {votes > 0 && (
                <span style={{ color: '#52525b', fontSize: '16px' }}>{votes.toLocaleString()} votes cast</span>
              )}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
