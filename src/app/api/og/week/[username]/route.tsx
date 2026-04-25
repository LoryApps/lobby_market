import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  person: 'CITIZEN',
  debator: 'DEBATOR',
  troll_catcher: 'TROLL CATCHER',
  elder: 'ELDER',
}

const ROLE_COLOR: Record<string, string> = {
  person: '#6b7280',
  debator: '#3b82f6',
  troll_catcher: '#10b981',
  elder: '#c9a84c',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#c9a84c',
  Politics: '#3b82f6',
  Technology: '#a78bfa',
  Science: '#34d399',
  Ethics: '#f87171',
  Philosophy: '#93c5fd',
  Culture: '#fbbf24',
  Health: '#fb7185',
  Environment: '#6ee7b7',
  Education: '#c4b5fd',
  Other: '#6b7280',
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const dow = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dow + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { start: monday.toISOString(), end: sunday.toISOString() }
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = await createClient()
    const { username } = params

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, vote_streak')
      .eq('username', username)
      .maybeSingle()

    if (!profile) {
      return new ImageResponse(<div style={{ color: 'white', background: '#0d0f14', width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>User not found</div>, { width: 1200, height: 630 })
    }

    const { start, end } = getWeekBounds()

    const [votesRes, argsRes] = await Promise.all([
      supabase
        .from('votes')
        .select('side, created_at, topics!inner(category)')
        .eq('user_id', profile.id)
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('topic_arguments')
        .select('id, upvotes')
        .eq('user_id', profile.id)
        .gte('created_at', start)
        .lte('created_at', end),
    ])

    const votes = (votesRes.data ?? []) as unknown as Array<{
      side: string
      created_at: string
      topics: { category: string | null } | null
    }>
    const args = argsRes.data ?? []

    const votesBlue = votes.filter((v) => v.side === 'blue').length
    const votesRed = votes.filter((v) => v.side === 'red').length
    const totalVotes = votes.length

    // Top category
    const catMap: Record<string, number> = {}
    for (const v of votes) {
      const cat = v.topics?.category ?? 'Other'
      catMap[cat] = (catMap[cat] ?? 0) + 1
    }
    const topCat = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0]

    const displayName = profile.display_name || profile.username
    const initials = displayName
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    const roleLabel = ROLE_LABEL[profile.role] ?? 'CITIZEN'
    const roleColor = ROLE_COLOR[profile.role] ?? '#6b7280'
    const weekLabel = formatWeekRange(start, end)

    // Votes by day for mini bar chart (Mon=0 to Sun=6)
    const dayMap: Record<string, number> = {}
    for (const v of votes) {
      const d = v.created_at.slice(0, 10)
      dayMap[d] = (dayMap[d] ?? 0) + 1
    }
    const maxDay = Math.max(1, ...Object.values(dayMap))

    // Build Mon–Sun array for current week
    const days: number[] = []
    const monDate = new Date(start)
    for (let i = 0; i < 7; i++) {
      const d = new Date(monDate)
      d.setUTCDate(monDate.getUTCDate() + i)
      const key = d.toISOString().slice(0, 10)
      days.push(dayMap[key] ?? 0)
    }

    const BAR_H = 60
    const BAR_W = 18
    const BAR_GAP = 8

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '56px 64px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Blue glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-80px',
              right: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
            }}
          />
          {/* Gold glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '-80px',
              width: '400px',
              height: '400px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)',
            }}
          />

          {/* Top row: brand + week label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #ef4444 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em' }}>
                LOBBY MARKET
              </span>
            </div>
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '0.06em' }}>
                WEEK OF {weekLabel.toUpperCase()}
              </span>
            </div>
          </div>

          {/* User identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
            {/* Avatar */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${roleColor}40 0%, ${roleColor}20 100%)`,
                border: `2px solid ${roleColor}60`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 800,
                color: roleColor,
              }}
            >
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff' }}>
                {displayName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>@{profile.username}</span>
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    background: `${roleColor}20`,
                    border: `1px solid ${roleColor}40`,
                    fontSize: '11px',
                    fontWeight: 700,
                    color: roleColor,
                    letterSpacing: '0.1em',
                  }}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
            {/* Headline stat */}
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ fontSize: '52px', fontWeight: 900, color: totalVotes > 0 ? '#3b82f6' : '#374151', lineHeight: 1 }}>
                {totalVotes}
              </span>
              <span style={{ fontSize: '12px', color: '#6b7280', letterSpacing: '0.1em' }}>VOTES THIS WEEK</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            {/* FOR votes */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(59,130,246,0.07)',
                border: '1px solid rgba(59,130,246,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#60a5fa' }}>{votesBlue}</span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>FOR</span>
            </div>

            {/* AGAINST votes */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#f87171' }}>{votesRed}</span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>AGAINST</span>
            </div>

            {/* Arguments */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(167,139,250,0.07)',
                border: '1px solid rgba(167,139,250,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#a78bfa' }}>{args.length}</span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>ARGUMENTS</span>
            </div>

            {/* Streak */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#c9a84c' }}>
                {profile.vote_streak ?? 0}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>DAY STREAK</span>
            </div>

            {/* Top category */}
            {topCat && (
              <div
                style={{
                  flex: 1.5,
                  padding: '16px 20px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: CATEGORY_COLORS[topCat[0]] ?? '#9ca3af',
                    lineHeight: 1.2,
                  }}
                >
                  {topCat[0]}
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>TOP CATEGORY</span>
              </div>
            )}
          </div>

          {/* Mini bar chart + footer */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
            {/* Bar chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#4b5563', letterSpacing: '0.1em' }}>DAILY VOTES</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${BAR_GAP}px` }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
                  const count = days[i] ?? 0
                  const barHeight = count > 0 ? Math.max(8, Math.round((count / maxDay) * BAR_H)) : 4
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: `${BAR_W}px`,
                          height: `${barHeight}px`,
                          borderRadius: '4px',
                          background: count > 0 ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.06)',
                        }}
                      />
                      <span style={{ fontSize: '10px', color: '#4b5563' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
              <span style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '0.1em' }}>
                lobby.market/share/week/{profile.username}
              </span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return new ImageResponse(
      <div style={{ color: 'white', background: '#0d0f14', width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Lobby Market · Weekly Stats
      </div>,
      { width: 1200, height: 630 }
    )
  }
}
