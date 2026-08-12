import { ImageResponse } from 'next/og'

export const alt = 'The Civic Charter · Lobby Market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function CharterOGImage() {
  const pillars = [
    { label: 'Truth', color: '#60a5fa' },
    { label: 'Justice', color: '#f59e0b' },
    { label: 'Liberty', color: '#f87171' },
    { label: 'Community', color: '#10b981' },
    { label: 'Progress', color: '#8b5cf6' },
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
          padding: '64px 72px 56px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Top: Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '22px', letterSpacing: '0.15em' }}>
              LOBBY MARKET
            </span>
            <div style={{ display: 'flex', width: '100%', height: '2px', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ flex: 1, background: '#3b82f6' }} />
              <div style={{ flex: 1, background: '#ef4444' }} />
            </div>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#71717a',
              fontWeight: 600,
            }}
          >
            FOUNDING DOCUMENT
          </div>
        </div>

        {/* Middle: Charter title */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: '13px',
              letterSpacing: '0.25em',
              color: '#71717a',
              fontWeight: 600,
              marginBottom: '16px',
              textTransform: 'uppercase',
            }}
          >
            THE CIVIC CHARTER
          </div>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 800,
              color: '#fafafa',
              lineHeight: 1.1,
              marginBottom: '20px',
              maxWidth: '700px',
            }}
          >
            Where debate becomes democracy
          </div>
          <div
            style={{
              fontSize: '18px',
              color: '#71717a',
              lineHeight: 1.5,
              maxWidth: '600px',
            }}
          >
            Six articles. Five pillars. One commitment to honest civic discourse — where the best arguments earn the force of law.
          </div>
        </div>

        {/* Pillars */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
          {pillars.map((p) => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: p.color,
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600, color: p.color }}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom bar — five-color stripe */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            display: 'flex',
          }}
        >
          {pillars.map((p) => (
            <div key={p.label} style={{ flex: 1, background: p.color }} />
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
