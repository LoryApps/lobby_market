import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  person: 'CITIZEN',
  moderator: 'MODERATOR',
  senator: 'SENATOR',
  admin: 'ADMIN',
}

const ROLE_COLORS: Record<string, string> = {
  person: '#71717a',
  moderator: '#10b981',
  senator: '#f59e0b',
  admin: '#8b5cf6',
}

const ARCHETYPE_LABELS: Record<string, string> = {
  the_guardian: 'The Guardian',
  the_reformer: 'The Reformer',
  the_advocate: 'The Advocate',
  the_analyst: 'The Analyst',
  the_diplomat: 'The Diplomat',
  the_visionary: 'The Visionary',
  the_contrarian: 'The Contrarian',
  the_pragmatist: 'The Pragmatist',
}

function fallback(username: string) {
  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', fontFamily: 'system-ui, -apple-system, sans-serif', flexDirection: 'column', gap: '12px' }}>
        <span style={{ color: '#fafafa', fontSize: '48px', fontWeight: 800, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
        <span style={{ color: '#52525b', fontSize: '20px' }}>@{username}</span>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const username = decodeURIComponent(params.username)

  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, role, clout, total_votes, total_arguments, civic_archetype, is_influencer')
      .eq('username', username)
      .single()

    if (!profile) return fallback(username)

    const roleColor = ROLE_COLORS[profile.role] ?? '#71717a'
    const roleLabel = ROLE_LABELS[profile.role] ?? profile.role.toUpperCase()
    const archetypeLabel = profile.civic_archetype
      ? (ARCHETYPE_LABELS[profile.civic_archetype] ?? profile.civic_archetype)
      : null

    const clout = profile.clout ?? 0
    const totalVotes = profile.total_votes ?? 0
    const totalArguments = profile.total_arguments ?? 0
    const displayName = profile.display_name ?? profile.username
    const initials = displayName.slice(0, 2).toUpperCase()
    const avatarHue = (username.charCodeAt(0) * 37 + (username.charCodeAt(1) || 0) * 17) % 360

    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

    const stats = [
      { label: 'CLOUT', value: fmt(clout) },
      { label: 'VOTES', value: fmt(totalVotes) },
      { label: 'ARGUMENTS', value: fmt(totalArguments) },
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
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Role-colored glow */}
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${roleColor}18 0%, transparent 70%)` }} />
          {/* Left accent stripe */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: `linear-gradient(180deg, ${roleColor}, ${roleColor}44)` }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '56px 72px 56px 84px' }}>
            {/* Brand */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '52px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex' }} />
                <span style={{ color: '#fafafa', fontSize: '16px', fontWeight: 700, letterSpacing: '0.18em' }}>LOBBY MARKET</span>
              </div>
              {profile.is_influencer && (
                <div style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.08em' }}>
                  VERIFIED INFLUENCER
                </div>
              )}
            </div>

            {/* Profile row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flex: 1 }}>
              {/* Avatar */}
              <div
                style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  background: `hsl(${avatarHue}, 60%, 35%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, border: `3px solid ${roleColor}66`,
                }}
              >
                <span style={{ color: '#fafafa', fontSize: '42px', fontWeight: 800 }}>{initials}</span>
              </div>
              {/* Name + role */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ color: '#fafafa', fontSize: '44px', fontWeight: 800, letterSpacing: '-0.02em' }}>{displayName}</span>
                <span style={{ color: '#52525b', fontSize: '20px', fontWeight: 500 }}>@{profile.username}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ background: `${roleColor}22`, color: roleColor, fontSize: '13px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', border: `1px solid ${roleColor}44`, letterSpacing: '0.1em' }}>
                    {roleLabel}
                  </div>
                  {archetypeLabel && (
                    <div style={{ background: '#1a1a22', color: '#a1a1aa', fontSize: '13px', fontWeight: 600, padding: '5px 12px', borderRadius: '20px', border: '1px solid #24242e' }}>
                      {archetypeLabel}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', marginTop: '40px', border: '1px solid #1a1a22', borderRadius: '14px', overflow: 'hidden' }}>
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '20px 0', background: i % 2 === 0 ? '#111117' : '#0f0f15',
                    borderRight: i < stats.length - 1 ? '1px solid #1a1a22' : 'none',
                  }}
                >
                  <span style={{ color: '#fafafa', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em' }}>{stat.value}</span>
                  <span style={{ color: '#52525b', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', marginTop: '4px' }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return fallback(username)
  }
}
