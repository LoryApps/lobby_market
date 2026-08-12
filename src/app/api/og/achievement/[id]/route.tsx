import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32', silver: '#c0c0c0', gold: '#f59e0b', platinum: '#a78bfa', legendary: '#10b981',
}

const TIER_BG: Record<string, string> = {
  bronze: 'rgba(205,127,50,0.12)', silver: 'rgba(192,192,192,0.10)', gold: 'rgba(245,158,11,0.12)',
  platinum: 'rgba(167,139,250,0.12)', legendary: 'rgba(16,185,129,0.12)',
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
    const { data: a } = await supabase
      .from('achievements')
      .select('name, description, icon, tier, category')
      .eq('id', params.id)
      .single()

    if (!a) return fallback()

    const tier = a.tier ?? 'gold'
    const tierColor = TIER_COLORS[tier] ?? '#f59e0b'
    const tierBg = TIER_BG[tier] ?? 'rgba(245,158,11,0.12)'
    const name = a.name ?? 'Achievement'
    const description = a.description ?? ''
    const icon = a.icon ?? '🏆'
    const category = a.category ?? 'General'

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
          {/* Radial glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '700px', height: '700px', borderRadius: '50%', background: `radial-gradient(circle, ${tierBg.replace('0.12', '0.25')} 0%, transparent 65%)`, marginTop: '-350px', marginLeft: '-350px' }} />
          {/* Top border */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)` }} />
          {/* Brand */}
          <div style={{ position: 'absolute', top: '40px', left: '60px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
            <span style={{ color: '#fafafa', fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
          </div>
          {/* Tier badge */}
          <div style={{ position: 'absolute', top: '40px', right: '60px', background: tierBg, color: tierColor, fontSize: '13px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${tierColor}44`, letterSpacing: '0.1em' }}>
            {tier.toUpperCase()}
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: tierBg, border: `2px solid ${tierColor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px' }}>
              {icon}
            </div>
            <span style={{ color: tierColor, fontSize: '14px', fontWeight: 700, letterSpacing: '0.2em' }}>ACHIEVEMENT UNLOCKED</span>
            <span style={{ color: '#fafafa', fontSize: name.length > 30 ? '42px' : '52px', fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center', maxWidth: '900px' }}>
              {name}
            </span>
            <span style={{ color: '#71717a', fontSize: '20px', textAlign: 'center', maxWidth: '720px', lineHeight: 1.5 }}>
              {description}
            </span>
            <div style={{ background: '#1a1a22', color: '#52525b', fontSize: '13px', fontWeight: 600, padding: '5px 14px', borderRadius: '20px', border: '1px solid #24242e', letterSpacing: '0.06em', marginTop: '4px' }}>
              {category.toUpperCase()}
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
