import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback() {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
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
    const { data: c } = await supabase
      .from('coalitions')
      .select('name, description, member_count, coalition_influence, wins, losses')
      .eq('id', params.id)
      .single()

    if (!c) return fallback()

    const name = c.name ?? 'Coalition'
    const memberCount = c.member_count ?? 0
    const influence = c.coalition_influence ?? 0
    const wins = c.wins ?? 0
    const losses = c.losses ?? 0
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null

    const initials = name.split(' ').slice(0, 2).map((w: string) => w[0] ?? '').join('').toUpperCase()
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

    const stats = [
      { label: 'MEMBERS', value: String(memberCount) },
      { label: 'INFLUENCE', value: fmt(influence) },
      { label: 'WIN RATE', value: winRate !== null ? `${winRate}%` : `${wins}W` },
    ]

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Purple glow */}
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
          {/* Purple top border */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '64px 72px 56px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
                <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
              </div>
              <div style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(139,92,246,0.3)', letterSpacing: '0.08em' }}>
                COALITION
              </div>
            </div>

            {/* Coalition identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
              <div
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <span style={{ color: '#fafafa', fontSize: '36px', fontWeight: 800 }}>{initials || 'C'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ color: '#fafafa', fontSize: name.length > 30 ? '38px' : '48px', fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</span>
                {c.description && (
                  <span style={{ color: '#71717a', fontSize: '18px', lineHeight: 1.4 }}>
                    {c.description.length > 120 ? c.description.slice(0, 117) + '…' : c.description}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', marginTop: '40px', border: '1px solid #1a1a22', borderRadius: '14px', overflow: 'hidden' }}>
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '20px 0', background: i % 2 === 0 ? '#111117' : '#0f0f15',
                    borderRight: i < stats.length - 1 ? '1px solid #1a1a22' : 'none',
                  }}
                >
                  <span style={{ color: '#fafafa', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>{stat.value}</span>
                  <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', marginTop: '4px' }}>{stat.label}</span>
                </div>
              ))}
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
