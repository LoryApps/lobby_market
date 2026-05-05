import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
      .maybeSingle()

    const statement = law?.statement ?? 'Established Law'
    const forPct = Math.round(law?.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const totalVotes = law?.total_votes ?? 0
    const category = law?.category ?? null
    const establishedAt = law?.established_at
      ? new Date(law.established_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : ''

    const fontSize = statement.length > 120 ? 30 : statement.length > 80 ? 36 : 42

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '60px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gold glow top center */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '500px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
            }}
          />
          {/* FOR glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '360px',
              height: '360px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
            }}
          />

          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '40px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(201,168,76,0.15)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: '#c9a84c', fontSize: '18px' }}>⚖</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#c9a84c',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Certificate of Civic Participation
              </span>
            </div>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#4b5563',
                letterSpacing: '0.1em',
              }}
            >
              LOBBY MARKET
            </span>
          </div>

          {/* Category pill */}
          {category && (
            <div
              style={{
                display: 'flex',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#c9a84c',
                  backgroundColor: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {category}
              </span>
            </div>
          )}

          {/* Law statement */}
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: `${fontSize}px`,
              color: '#f9fafb',
              fontWeight: 700,
              lineHeight: 1.3,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              maxWidth: '920px',
            }}
          >
            &ldquo;{statement}&rdquo;
          </div>

          {/* Footer stats */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: '1px solid rgba(75,85,99,0.4)',
            }}
          >
            {/* Vote bar + percentages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  height: '6px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  width: '300px',
                  background: 'rgba(55,65,81,0.8)',
                }}
              >
                <div
                  style={{
                    width: `${forPct}%`,
                    height: '100%',
                    background: '#3b82f6',
                  }}
                />
                <div
                  style={{
                    width: `${againstPct}%`,
                    height: '100%',
                    background: '#dc2626',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#60a5fa' }}>
                  FOR {forPct}%
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#f87171' }}>
                  AGAINST {againstPct}%
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#9ca3af' }}>
                  {totalVotes.toLocaleString()} votes
                </span>
              </div>
            </div>

            {/* Established date */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b7280' }}>
                Established
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#d1d5db', fontWeight: 600 }}>
                {establishedAt}
              </span>
            </div>
          </div>

          {/* Seal watermark */}
          <div
            style={{
              position: 'absolute',
              right: '60px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: '2px solid rgba(201,168,76,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.4,
            }}
          >
            <div
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '36px', color: 'rgba(201,168,76,0.8)' }}>⚖</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (err) {
    console.error('[og/certificate]', err)
    return new Response('Failed to generate image', { status: 500 })
  }
}
