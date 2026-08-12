import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  person: 'CITIZEN',
  debator: 'DEBATOR',
  troll_catcher: 'TROLL CATCHER',
  elder: 'ELDER',
  lawmaker: 'LAWMAKER',
  senator: 'SENATOR',
}

const ROLE_COLOR: Record<string, string> = {
  person: '#6b7280',
  debator: '#3b82f6',
  troll_catcher: '#10b981',
  elder: '#c9a84c',
  lawmaker: '#c9a84c',
  senator: '#a78bfa',
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

function getYearBounds(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01T00:00:00.000Z`,
    end: `${year}-12-31T23:59:59.999Z`,
  }
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
      .select('id, username, display_name, avatar_url, role, clout, vote_streak, blue_vote_count, total_votes, total_arguments')
      .eq('username', username)
      .maybeSingle()

    if (!profile) {
      return new ImageResponse(
        <div style={{ color: 'white', background: '#0d0f14', width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
          User not found
        </div>,
        { width: 1200, height: 630 }
      )
    }

    const year = new Date().getUTCFullYear()
    const { start, end } = getYearBounds(year)

    const [votesRes, argsRes] = await Promise.all([
      supabase
        .from('votes')
        .select('side, topics!inner(category)')
        .eq('user_id', profile.id)
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('topic_arguments')
        .select('id')
        .eq('user_id', profile.id)
        .gte('created_at', start)
        .lte('created_at', end),
    ])

    const votes = (votesRes.data ?? []) as unknown as Array<{
      side: string
      topics: { category: string | null } | null
    }>
    const args = argsRes.data ?? []

    const votesFor = votes.filter((v) => v.side === 'blue').length
    const votesAgainst = votes.filter((v) => v.side === 'red').length
    const totalVotes = votes.length

    const forPct = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 50
    const againstPct = 100 - forPct

    // Top category
    const catMap: Record<string, number> = {}
    for (const v of votes) {
      const cat = v.topics?.category ?? 'Other'
      catMap[cat] = (catMap[cat] ?? 0) + 1
    }
    const topCatEntry = Object.entries(catMap).sort(([, a], [, b]) => b - a)[0]

    const displayName = profile.display_name || profile.username
    const initials = displayName
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    const roleLabel = ROLE_LABEL[profile.role] ?? 'CITIZEN'
    const roleColor = ROLE_COLOR[profile.role] ?? '#6b7280'

    // FOR/AGAINST bar width (out of 400px)
    const BAR_TOTAL = 400
    const forBarW = Math.round((forPct / 100) * BAR_TOTAL)
    const againstBarW = BAR_TOTAL - forBarW

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            padding: '52px 64px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'monospace',
          }}
        >
          {/* Blue glow top-left */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              left: '-100px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            }}
          />
          {/* Red glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
            }}
          />
          {/* Gold glow bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: '-80px',
              left: '50%',
              width: '600px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
            }}
          />

          {/* Top row: brand + year label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
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
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em' }}>
                LOBBY MARKET
              </span>
            </div>
            <div
              style={{
                padding: '6px 18px',
                borderRadius: '999px',
                background: 'rgba(201,168,76,0.10)',
                border: '1px solid rgba(201,168,76,0.3)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#c9a84c', letterSpacing: '0.12em', fontWeight: 700 }}>
                {year} LOBBY WRAPPED
              </span>
            </div>
          </div>

          {/* User identity row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}>
            {/* Avatar */}
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${roleColor}30 0%, ${roleColor}15 100%)`,
                border: `2px solid ${roleColor}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 800,
                color: roleColor,
              }}
            >
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
                {displayName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#4b5563' }}>@{profile.username}</span>
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '999px',
                    background: `${roleColor}18`,
                    border: `1px solid ${roleColor}35`,
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

            {/* Headline stat: total votes this year */}
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ fontSize: '56px', fontWeight: 900, color: totalVotes > 0 ? '#3b82f6' : '#374151', lineHeight: 1 }}>
                {totalVotes}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em' }}>VOTES IN {year}</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
            {/* Arguments */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(167,139,250,0.07)',
                border: '1px solid rgba(167,139,250,0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{args.length}</span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em', marginTop: '2px' }}>ARGUMENTS</span>
            </div>

            {/* Vote streak */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(201,168,76,0.07)',
                border: '1px solid rgba(201,168,76,0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#c9a84c', lineHeight: 1 }}>
                {profile.vote_streak ?? 0}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em', marginTop: '2px' }}>DAY STREAK</span>
            </div>

            {/* Clout */}
            <div
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '14px',
                background: 'rgba(52,211,153,0.06)',
                border: '1px solid rgba(52,211,153,0.16)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '30px', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                {(profile.clout ?? 0).toLocaleString()}
              </span>
              <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em', marginTop: '2px' }}>CLOUT</span>
            </div>

            {/* Top category */}
            {topCatEntry ? (
              <div
                style={{
                  flex: 1.4,
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
                    fontSize: '22px',
                    fontWeight: 800,
                    color: CATEGORY_COLORS[topCatEntry[0]] ?? '#9ca3af',
                    lineHeight: 1.2,
                  }}
                >
                  {topCatEntry[0]}
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em', marginTop: '2px' }}>TOP CATEGORY</span>
              </div>
            ) : (
              <div
                style={{
                  flex: 1.4,
                  padding: '16px 20px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#374151', lineHeight: 1.2 }}>—</span>
                <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.1em', marginTop: '2px' }}>TOP CATEGORY</span>
              </div>
            )}
          </div>

          {/* FOR / AGAINST bar + footer */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
            {/* FOR/AGAINST split bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#4b5563', letterSpacing: '0.1em' }}>VOTE SPLIT</span>
              <div style={{ display: 'flex', height: '12px', width: `${BAR_TOTAL}px`, borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                {forBarW > 0 && (
                  <div
                    style={{
                      width: `${forBarW}px`,
                      height: '100%',
                      background: 'rgba(59,130,246,0.75)',
                      borderRadius: againstBarW === 0 ? '6px' : '6px 0 0 6px',
                    }}
                  />
                )}
                {againstBarW > 0 && (
                  <div
                    style={{
                      width: `${againstBarW}px`,
                      height: '100%',
                      background: 'rgba(239,68,68,0.75)',
                      borderRadius: forBarW === 0 ? '6px' : '0 6px 6px 0',
                    }}
                  />
                )}
              </div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 700 }}>{forPct}% FOR</span>
                <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 700 }}>{againstPct}% AGAINST</span>
              </div>
            </div>

            {/* Footer brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.45 }}>
              <span style={{ fontSize: '13px', color: '#9ca3af', letterSpacing: '0.1em' }}>
                lobby.market/wrapped
              </span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    return new ImageResponse(
      <div style={{ color: 'white', background: '#0d0f14', width: '1200px', height: '630px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        Lobby Market · Civic Wrapped
      </div>,
      { width: 1200, height: 630 }
    )
  }
}
