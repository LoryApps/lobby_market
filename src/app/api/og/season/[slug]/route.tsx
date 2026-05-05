import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function fallback(label: string) {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1200px',
          height: '630px',
          backgroundColor: '#0d0f14',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', color: '#c9a84c', fontSize: '14px', letterSpacing: '0.18em', fontWeight: 700 }}>
          LOBBY MARKET
        </div>
        <div style={{ display: 'flex', color: '#f1f5f9', fontSize: '28px', fontWeight: 700 }}>
          {label}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

const MEDAL = ['🥇', '🥈', '🥉']

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient()

    // Load season
    const { data: season } = await supabase
      .from('civic_seasons')
      .select('*')
      .eq('slug', params.slug)
      .maybeSingle()

    if (!season) return fallback('Season Not Found')

    // Load top 3 from season_points
    const { data: pointRows } = await supabase
      .from('season_points')
      .select(
        `vote_pts, argument_pts, debate_pts, law_pts, upvote_pts, prediction_pts, user_id,
         profiles!inner(username, display_name, avatar_url)`
      )
      .eq('season_id', season.id)
      .limit(200)

    type RawRow = {
      vote_pts: number
      argument_pts: number
      debate_pts: number
      law_pts: number
      upvote_pts: number
      prediction_pts: number
      user_id: string
      profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
    }

    const sorted = ((pointRows ?? []) as RawRow[])
      .filter((r) => r.profiles !== null)
      .map((r) => ({
        username: r.profiles!.username,
        display_name: r.profiles!.display_name,
        total_pts:
          r.vote_pts + r.argument_pts + r.debate_pts + r.law_pts + r.upvote_pts + r.prediction_pts,
      }))
      .sort((a, b) => b.total_pts - a.total_pts)
      .slice(0, 3)

    const themeColor = season.theme_color ?? '#c9a84c'
    const isActive = season.is_active

    const startDate = new Date(season.starts_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const endDate = new Date(season.ends_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const now = Date.now()
    const endsAt = new Date(season.ends_at).getTime()
    const daysLeft = isActive ? Math.max(0, Math.ceil((endsAt - now) / 86_400_000)) : 0

    const champion = sorted[0]

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
            fontFamily: 'monospace',
          }}
        >
          {/* Ambient glow using theme color */}
          <div
            style={{
              position: 'absolute',
              top: '-160px',
              right: '-160px',
              width: '560px',
              height: '560px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${themeColor}22 0%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-120px',
              width: '420px',
              height: '420px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
            }}
          />

          {/* Top accent line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)`,
            }}
          />

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: themeColor }} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: themeColor, letterSpacing: '0.18em' }}>
                LOBBY MARKET
              </span>
            </div>

            {/* Season status badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 14px',
                borderRadius: '6px',
                backgroundColor: isActive ? `${themeColor}20` : '#1a1d2820',
                border: `1px solid ${isActive ? themeColor + '60' : '#4b556340'}`,
                fontSize: '11px',
                fontWeight: 700,
                color: isActive ? themeColor : '#6b7280',
                letterSpacing: '0.12em',
              }}
            >
              {isActive ? `${daysLeft} DAYS LEFT` : 'CONCLUDED'}
            </div>
          </div>

          {/* Season name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#6b7280',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              CIVIC SEASON
            </span>
            <span
              style={{
                fontSize: season.name.length > 30 ? 42 : 50,
                fontWeight: 800,
                color: '#f1f5f9',
                lineHeight: 1.1,
              }}
            >
              {season.name}
            </span>
            {season.tagline && (
              <span style={{ fontSize: '17px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                {season.tagline}
              </span>
            )}
          </div>

          {/* Podium section */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', gap: '16px', marginBottom: '28px' }}>
            {sorted.length > 0 ? (
              sorted.map((entry, i) => (
                <div
                  key={entry.username}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    flex: i === 0 ? 1.4 : 1,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      backgroundColor: i === 0 ? `${themeColor}18` : '#1e2030',
                      border: `1px solid ${i === 0 ? themeColor + '50' : '#2d3144'}`,
                      width: '100%',
                    }}
                  >
                    <span style={{ fontSize: i === 0 ? '28px' : '22px' }}>{MEDAL[i]}</span>
                    <span
                      style={{
                        fontSize: i === 0 ? '15px' : '13px',
                        fontWeight: 700,
                        color: i === 0 ? '#f1f5f9' : '#94a3b8',
                        marginTop: '4px',
                      }}
                    >
                      {entry.display_name || entry.username}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: i === 0 ? themeColor : '#6b7280',
                        marginTop: '2px',
                        fontWeight: 600,
                      }}
                    >
                      {entry.total_pts.toLocaleString()} pts
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  borderRadius: '12px',
                  backgroundColor: '#1e2030',
                  border: '1px solid #2d3144',
                  color: '#4b5563',
                  fontSize: '15px',
                }}
              >
                {isActive ? 'Be the first to earn Season Points' : 'No participants recorded'}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#4b5563' }}>
            <span>{startDate} – {endDate}</span>
            {champion && !isActive && (
              <span style={{ color: themeColor, fontWeight: 600 }}>
                Champion: {champion.display_name || champion.username}
              </span>
            )}
            <span style={{ color: '#374151' }}>lobby.market/season</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch (err) {
    console.error('[og/season]', err)
    return fallback('Civic Season')
  }
}
