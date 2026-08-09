import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback() {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <span style={{ color: '#f59e0b', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
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
    const { data: law } = await supabase
      .from('laws')
      .select('statement, category, blue_pct, total_votes, established_at')
      .eq('id', params.id)
      .single()

    if (!law) return fallback()

    const forPct = Math.round(law.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const votes = law.total_votes ?? 0
    const statement = law.statement ?? ''
    const fontSize = statement.length > 100 ? 30 : statement.length > 60 ? 38 : 44

    let dateLabel: string | null = null
    if (law.established_at) {
      try {
        dateLabel = new Date(law.established_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      } catch { dateLabel = null }
    }

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
          {/* Gold glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '800px', height: '500px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)', marginTop: '-250px', marginLeft: '-400px' }} />

          {/* Gold corner frames */}
          <div style={{ position: 'absolute', top: '24px', left: '24px', width: '60px', height: '60px', borderTop: '2px solid #f59e0b88', borderLeft: '2px solid #f59e0b88', borderRadius: '4px 0 0 0' }} />
          <div style={{ position: 'absolute', top: '24px', right: '24px', width: '60px', height: '60px', borderTop: '2px solid #f59e0b88', borderRight: '2px solid #f59e0b88', borderRadius: '0 4px 0 0' }} />
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', width: '60px', height: '60px', borderBottom: '2px solid #f59e0b88', borderLeft: '2px solid #f59e0b88', borderRadius: '0 0 0 4px' }} />
          <div style={{ position: 'absolute', bottom: '24px', right: '24px', width: '60px', height: '60px', borderBottom: '2px solid #f59e0b88', borderRight: '2px solid #f59e0b88', borderRadius: '0 0 4px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '60px 80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
                <span style={{ color: '#fafafa', fontSize: '15px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
              </div>
              <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3em' }}>CERTIFICATE OF LAW</span>
              {dateLabel && <span style={{ color: '#52525b', fontSize: '13px' }}>Established {dateLabel}</span>}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #f59e0b55, transparent)', marginBottom: '36px' }} />

            {/* Statement */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#fafafa', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.4, textAlign: 'center', margin: 0, maxWidth: '900px' }}>
                {statement}
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #f59e0b55, transparent)', marginTop: '36px', marginBottom: '20px' }} />

            {/* Stats */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '56px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#60a5fa', fontSize: '28px', fontWeight: 800 }}>{forPct}%</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>FOR</span>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#24242e' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#f87171', fontSize: '28px', fontWeight: 800 }}>{againstPct}%</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>AGAINST</span>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#24242e' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#fafafa', fontSize: '28px', fontWeight: 800 }}>{votes >= 1000 ? `${(votes / 1000).toFixed(1)}k` : String(votes)}</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>VOTES</span>
              </div>
              {law.category && (
                <>
                  <div style={{ width: '1px', height: '40px', background: '#24242e' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '18px', fontWeight: 700 }}>{law.category}</span>
                    <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>CATEGORY</span>
                  </div>
                </>
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
