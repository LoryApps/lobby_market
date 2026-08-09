import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback() {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <span style={{ color: '#10b981', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET EXCHANGE</span>
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
      .select('statement, category, blue_pct, total_votes')
      .eq('id', params.id)
      .single()

    if (!topic) return fallback()

    const statement = topic.statement ?? 'A prediction market'
    const currentPrice = Math.round(topic.blue_pct ?? 50)
    const category = topic.category
    const volume = topic.total_votes ?? 0
    const isAbove50 = currentPrice > 50
    const accentColor = isAbove50 ? '#10b981' : '#ef4444'
    const change = Math.abs(currentPrice - 50)

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', padding: '64px 72px 60px' }}>
          <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {category && <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e' }}>{category}</div>}
              <div style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', letterSpacing: '0.08em' }}>EXCHANGE</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p style={{ color: '#fafafa', fontSize: statement.length > 100 ? 30 : statement.length > 60 ? 38 : 46, fontWeight: 700, lineHeight: 1.35, margin: 0, maxWidth: '860px' }}>
              {statement}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', marginTop: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#52525b', fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em' }}>CURRENT PRICE</span>
              <span style={{ color: accentColor, fontSize: '56px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>{currentPrice}¢</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px' }}>
              <span style={{ color: accentColor, fontSize: '22px', fontWeight: 700 }}>{isAbove50 ? '+' : '-'}{change}¢ vs 50¢</span>
              {volume > 0 && <span style={{ color: '#3f3f4a', fontSize: '15px' }}>{volume.toLocaleString()} vol.</span>}
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
