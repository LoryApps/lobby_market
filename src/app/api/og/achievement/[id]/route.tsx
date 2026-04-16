import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Tier visual config ───────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  string,
  { label: string; glow: string; accent: string; badge: string; badgeText: string }
> = {
  legendary: {
    label: 'LEGENDARY',
    glow: 'rgba(201,168,76,0.18)',
    accent: '#c9a84c',
    badge: 'rgba(201,168,76,0.15)',
    badgeText: '#c9a84c',
  },
  epic: {
    label: 'EPIC',
    glow: 'rgba(139,92,246,0.18)',
    accent: '#8b5cf6',
    badge: 'rgba(139,92,246,0.15)',
    badgeText: '#a78bfa',
  },
  rare: {
    label: 'RARE',
    glow: 'rgba(59,130,246,0.18)',
    accent: '#3b82f6',
    badge: 'rgba(59,130,246,0.15)',
    badgeText: '#60a5fa',
  },
  common: {
    label: 'COMMON',
    glow: 'rgba(113,113,122,0.15)',
    accent: '#71717a',
    badge: 'rgba(113,113,122,0.12)',
    badgeText: '#a1a1aa',
  },
}

const FALLBACK = TIER_CONFIG.common

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    const { data: achievement } = await supabase
      .from('achievements')
      .select('name, description, icon, tier, slug')
      .eq('id', params.id)
      .single()

    const name = achievement?.name ?? 'Achievement Unlocked'
    const description = achievement?.description ?? ''
    const icon = achievement?.icon ?? ''
    const tier = (achievement?.tier as string) ?? 'common'
    const cfg = TIER_CONFIG[tier] ?? FALLBACK

    // Truncate long descriptions
    const desc =
      description.length > 100
        ? description.slice(0, 97) + '…'
        : description

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
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Radial glow — top center */}
          <div
            style={{
              position: 'absolute',
              top: '-160px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '700px',
              height: '700px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 65%)`,
            }}
          />

          {/* Bottom-right corner glow */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              right: '-120px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${cfg.glow} 0%, transparent 70%)`,
            }}
          />

          {/* Header row: Lobby Market brand + tier badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '48px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Diamond logo mark */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                }}
              >
                ⚖
              </div>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#71717a',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Lobby Market
              </span>
            </div>

            {/* Tier badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: cfg.badge,
                border: `1px solid ${cfg.accent}40`,
                borderRadius: '999px',
                padding: '8px 20px',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: cfg.accent,
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.15em',
                  color: cfg.badgeText,
                }}
              >
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Main content — icon + name + description */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
            }}
          >
            {/* Achievement icon bubble */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '120px',
                borderRadius: '32px',
                background: cfg.badge,
                border: `2px solid ${cfg.accent}50`,
                fontSize: '56px',
                boxShadow: `0 0 60px ${cfg.glow}`,
              }}
            >
              {icon || '🏆'}
            </div>

            {/* "Achievement Unlocked" label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '1px',
                  background: `${cfg.accent}60`,
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: cfg.badgeText,
                }}
              >
                Achievement Unlocked
              </span>
              <div
                style={{
                  width: '40px',
                  height: '1px',
                  background: `${cfg.accent}60`,
                }}
              />
            </div>

            {/* Achievement name */}
            <div
              style={{
                fontSize: name.length > 30 ? 44 : 54,
                fontWeight: '800',
                color: '#f4f4f5',
                letterSpacing: '-0.02em',
                textAlign: 'center',
                lineHeight: 1.1,
                maxWidth: '800px',
              }}
            >
              {name}
            </div>

            {/* Description */}
            {desc && (
              <div
                style={{
                  fontSize: '22px',
                  color: '#71717a',
                  textAlign: 'center',
                  maxWidth: '700px',
                  lineHeight: 1.5,
                  fontWeight: '400',
                }}
              >
                {desc}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '40px',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                color: '#3f3f46',
                letterSpacing: '0.06em',
              }}
            >
              lobby.market · Write the law. Build the consensus.
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    )
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <span style={{ color: '#71717a', fontSize: '24px' }}>
            Achievement · Lobby Market
          </span>
        </div>
      ),
      { width: 1200, height: 630 },
    )
  }
}
