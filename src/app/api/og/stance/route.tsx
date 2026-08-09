import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Usage: /api/og/stance?statement=...&side=for|against&pct=58&votes=2341
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statement = searchParams.get('statement') ?? 'A civic statement'
  const side = searchParams.get('side') === 'against' ? 'against' : 'for'
  const pct = Math.min(100, Math.max(0, parseInt(searchParams.get('pct') ?? '50', 10)))
  const votes = parseInt(searchParams.get('votes') ?? '0', 10)

  const isFor = side === 'for'
  const accentColor = isFor ? '#3b82f6' : '#ef4444'
  const accentColorDeep = isFor ? '#1d4ed8' : '#b91c1c'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideSubLabel = isFor ? 'in favour' : 'opposed'
  const fontSize = statement.length > 120 ? 28 : statement.length > 80 ? 34 : 40

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
        {/* Bottom glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '50%',
            width: '600px',
            height: '300px',
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${accentColor}20 0%, transparent 70%)`,
            marginLeft: '-300px',
          }}
        />
        {/* Bottom color strip */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${accentColorDeep}, ${accentColor})` }} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '60px 72px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
              <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
            </div>
            <div style={{ background: '#1a1a22', color: '#71717a', fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: '1px solid #24242e', letterSpacing: '0.06em' }}>
              MY STANCE
            </div>
          </div>

          {/* Voted label */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '28px' }}>
            <span style={{ color: '#52525b', fontSize: '22px', fontWeight: 600 }}>I voted</span>
            <span style={{ color: accentColor, fontSize: '56px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>{sideLabel}</span>
            <span style={{ color: '#52525b', fontSize: '22px', fontWeight: 600 }}>{sideSubLabel}</span>
          </div>

          {/* Statement */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', paddingLeft: '24px', borderLeft: `3px solid ${accentColor}66` }}>
            <p style={{ color: '#d4d4d8', fontSize: `${fontSize}px`, fontWeight: 600, lineHeight: 1.4, margin: 0, maxWidth: '960px', fontStyle: 'italic' }}>
              &ldquo;{statement}&rdquo;
            </p>
          </div>

          {/* Bottom: pct + votes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ color: accentColor, fontSize: '48px', fontWeight: 900, letterSpacing: '-0.03em' }}>{pct}%</span>
              <span style={{ color: '#52525b', fontSize: '18px', fontWeight: 500 }}>of voters agree</span>
            </div>
            {votes > 0 && (
              <span style={{ color: '#3f3f4a', fontSize: '16px' }}>{votes.toLocaleString()} votes cast</span>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
