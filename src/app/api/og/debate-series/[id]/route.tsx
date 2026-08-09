import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  ongoing: '#10b981', completed: '#71717a', cancelled: '#ef4444',
  // Legacy support
  scheduling: '#f59e0b', active: '#10b981',
}

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
    const { data: series } = await supabase
      .from('debate_series')
      .select('title, format, status, blue_wins, red_wins')
      .eq('id', params.id)
      .single()

    if (!series) return fallback()

    const title = series.title ?? 'Debate Series'
    const format = series.format
    const status = series.status ?? 'ongoing'
    const statusColor = STATUS_COLORS[status] ?? '#71717a'
    const totalRounds = (series.blue_wins ?? 0) + (series.red_wins ?? 0)
    const fontSize = title.length > 80 ? 34 : title.length > 50 ? 44 : 52

    const FORMAT_LABELS: Record<string, string> = {
      best_of_3: 'BEST OF 3', best_of_5: 'BEST OF 5',
      best_of_7: 'BEST OF 7', fixed: 'SERIES',
    }
    const formatLabel = format ? (FORMAT_LABELS[format] ?? format.toUpperCase()) : null

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', padding: '64px 72px 60px' }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '44px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {formatLabel && <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e', letterSpacing: '0.06em' }}>{formatLabel}</div>}
              <div style={{ background: `${statusColor}22`, color: statusColor, fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${statusColor}44`, letterSpacing: '0.08em' }}>DEBATE SERIES</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <p style={{ color: '#fafafa', fontSize: `${fontSize}px`, fontWeight: 800, lineHeight: 1.3, margin: 0, maxWidth: '980px' }}>
              {title}
            </p>
          </div>
          {totalRounds > 0 && (
            <div style={{ marginTop: '28px', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#60a5fa', fontSize: '28px', fontWeight: 800 }}>{series.blue_wins}</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>FOR WINS</span>
              </div>
              <span style={{ color: '#3f3f4a', fontSize: '24px', fontWeight: 700 }}>:</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#f87171', fontSize: '28px', fontWeight: 800 }}>{series.red_wins}</span>
                <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em' }}>AGAINST WINS</span>
              </div>
            </div>
          )}
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback()
  }
}
