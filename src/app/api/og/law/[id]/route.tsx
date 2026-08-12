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
    const fontSize = statement.length > 120 ? 30 : statement.length > 80 ? 36 : 44

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
            padding: '64px 72px 60px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
          }}
        >
          {/* Gold glow */}
          <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)' }} />
          {/* Gold top border */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '17px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {law.category && (
                <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e' }}>
                  {law.category}
                </div>
              )}
              <div style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.08em' }}>
                ESTABLISHED LAW
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p style={{ color: '#fafafa', fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.35, margin: 0, maxWidth: '980px' }}>
              {statement}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '32px' }}>
            <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', background: '#1a1a22' }}>
              <div style={{ width: `${forPct}%`, background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)', height: '100%' }} />
              <div style={{ width: `${againstPct}%`, background: 'linear-gradient(90deg, #ef4444, #b91c1c)', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '28px' }}>
                <span style={{ color: '#60a5fa', fontSize: '22px', fontWeight: 800 }}>{forPct}% For</span>
                <span style={{ color: '#f87171', fontSize: '22px', fontWeight: 800 }}>{againstPct}% Against</span>
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                {votes > 0 && <span style={{ color: '#52525b', fontSize: '15px' }}>{votes.toLocaleString()} votes</span>}
                {dateLabel && <span style={{ color: '#52525b', fontSize: '15px' }}>{dateLabel}</span>}
              </div>
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
