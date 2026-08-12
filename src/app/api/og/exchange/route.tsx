import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// /api/og/exchange?topic=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topicTitle = searchParams.get('topic') ?? 'Prediction Markets'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', marginTop: '-350px', marginLeft: '-350px' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #065f46, #10b981, #065f46)' }} />
        <div style={{ position: 'absolute', top: '32px', left: '60px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
          <span style={{ color: '#fafafa', fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
        </div>
        <div style={{ position: 'absolute', top: '32px', right: '60px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.3)', letterSpacing: '0.08em' }}>
          EXCHANGE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 700, letterSpacing: '0.25em' }}>PREDICTION MARKET</span>
          <span style={{ color: '#fafafa', fontSize: topicTitle.length > 60 ? '36px' : '52px', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', maxWidth: '900px', lineHeight: 1.3 }}>
            {topicTitle}
          </span>
          <span style={{ color: '#52525b', fontSize: '18px', marginTop: '8px' }}>Trade your conviction on Lobby Market</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
