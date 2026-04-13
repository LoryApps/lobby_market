import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Role display config ────────────────────────────────────────────────────────

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

// ── Stat box helper (rendered as JSX in ImageResponse context) ─────────────────

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '14px 22px',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: '130px',
      }}
    >
      <span style={{ fontSize: '26px', fontWeight: 800, color: accent }}>
        {value}
      </span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#6b7280',
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Avatar circle (initials-based since external images can't be fetched in OG) ─

function AvatarCircle({
  initials,
  roleColor,
}: {
  initials: string
  roleColor: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${roleColor}40, ${roleColor}18)`,
        border: `3px solid ${roleColor}60`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: '44px',
          fontWeight: 800,
          color: roleColor,
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'username, display_name, bio, role, clout, reputation_score, total_votes'
      )
      .eq('username', params.username)
      .maybeSingle()

    const username = profile?.username ?? params.username
    const displayName = profile?.display_name || username
    const role = profile?.role ?? 'person'
    const clout = profile?.clout ?? 0
    const totalVotes = profile?.total_votes ?? 0
    const repScore = profile?.reputation_score ?? 0
    const bio = profile?.bio ?? null

    const roleLabel = ROLE_LABEL[role] ?? role.toUpperCase()
    const roleColor = ROLE_COLOR[role] ?? '#6b7280'

    // Initials from display name
    const initials = displayName
      .split(' ')
      .map((w: string) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // Trim bio to ~100 chars for card
    const bioSnippet = bio
      ? bio.length > 100
        ? bio.slice(0, 97) + '…'
        : bio
      : null

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
          {/* Ambient role-colored glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-140px',
              right: '-140px',
              width: '560px',
              height: '560px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${roleColor}18 0%, transparent 70%)`,
            }}
          />
          {/* Subtle blue glow bottom-left */}
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              left: '-100px',
              width: '460px',
              height: '460px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
            }}
          />
          {/* Fine top border line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${roleColor}, transparent)`,
            }}
          />

          {/* ── Header row ─────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '48px',
            }}
          >
            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#c9a84c',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#c9a84c',
                  letterSpacing: '0.18em',
                }}
              >
                LOBBY MARKET
              </span>
            </div>

            {/* Role badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 16px',
                borderRadius: '6px',
                backgroundColor: `${roleColor}18`,
                border: `1px solid ${roleColor}45`,
                fontSize: '11px',
                fontWeight: 700,
                color: roleColor,
                letterSpacing: '0.14em',
              }}
            >
              {roleLabel}
            </div>
          </div>

          {/* ── Identity row ──────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
            {/* Avatar */}
            <AvatarCircle initials={initials} roleColor={roleColor} />

            {/* Name + username + bio */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: '52px',
                  fontWeight: 800,
                  color: '#f1f5f9',
                  lineHeight: 1.1,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: '#4b5563',
                  fontWeight: 500,
                }}
              >
                @{username}
              </div>
              {bioSnippet && (
                <div
                  style={{
                    fontSize: '17px',
                    color: '#6b7280',
                    marginTop: '6px',
                    lineHeight: 1.5,
                    maxWidth: '680px',
                  }}
                >
                  {bioSnippet}
                </div>
              )}
            </div>
          </div>

          {/* ── Stats row ─────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginTop: '36px',
            }}
          >
            <StatBox
              label="CLOUT"
              value={formatCount(clout)}
              accent={roleColor}
            />
            <StatBox
              label="VOTES CAST"
              value={formatCount(totalVotes)}
              accent="#3b82f6"
            />
            <StatBox
              label="REPUTATION"
              value={formatCount(repScore)}
              accent="#10b981"
            />
            <div style={{ flex: 1 }} />
            <span
              style={{
                fontSize: '12px',
                color: '#374151',
                letterSpacing: '0.06em',
              }}
            >
              lobby.market
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  } catch {
    // Minimal fallback
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1200px',
            height: '630px',
            backgroundColor: '#0d0f14',
            color: '#c9a84c',
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}
        >
          LOBBY MARKET · PROFILE
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
