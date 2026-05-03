import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_COLOR: Record<string, string> = {
  person: '#71717a',
  debator: '#3b82f6',
  troll_catcher: '#10b981',
  elder: '#c9a84c',
  lawmaker: '#8b5cf6',
  senator: '#8b5cf6',
}

const ROLE_RING: Record<string, string> = {
  person: '#3f3f4a',
  debator: '#1d4ed8',
  troll_catcher: '#059669',
  elder: '#b45309',
  lawmaker: '#6d28d9',
  senator: '#6d28d9',
}

// ─── SVG badge builder ────────────────────────────────────────────────────────

interface BadgeData {
  username: string
  displayName: string
  role: string
  clout: number
  totalVotes: number
  repScore: number
  voteStreak: number
}

function buildSvg(d: BadgeData): string {
  const roleLabel = ROLE_LABEL[d.role] ?? d.role
  const roleColor = ROLE_COLOR[d.role] ?? '#71717a'
  const roleRing = ROLE_RING[d.role] ?? '#3f3f4a'

  // Initials from display name (max 2 chars)
  const initials = d.displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const W = 440
  const H = 130
  const avatarCx = 64
  const avatarCy = 65
  const avatarR = 40

  // Stats: clout | votes | rep | streak
  const stats = [
    { label: 'CLOUT',  value: fmtNumber(d.clout),      color: '#f59e0b' },
    { label: 'VOTES',  value: fmtNumber(d.totalVotes),  color: '#3b82f6' },
    { label: 'REP',    value: fmtNumber(d.repScore),    color: '#10b981' },
    { label: 'STREAK', value: d.voteStreak > 0 ? `${d.voteStreak}d` : '—', color: '#8b5cf6' },
  ]

  const statBoxW = 80
  const statBoxH = 46
  const statStartX = 122
  const statY = 45

  // Dynamic stat box spacing across available width
  const statGap = (W - statStartX - 14 - statBoxW * stats.length) / (stats.length - 1)

  const statBoxes = stats
    .map((s, i) => {
      const x = statStartX + i * (statBoxW + statGap)
      return `
        <rect x="${x}" y="${statY}" width="${statBoxW}" height="${statBoxH}" rx="8"
          fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <text x="${x + statBoxW / 2}" y="${statY + 17}" font-family="ui-monospace,monospace"
          font-size="15" font-weight="800" fill="${s.color}" text-anchor="middle">${esc(s.value)}</text>
        <text x="${x + statBoxW / 2}" y="${statY + 33}" font-family="ui-monospace,monospace"
          font-size="8.5" font-weight="700" fill="#71717a" text-anchor="middle" letter-spacing="0.08em">${esc(s.label)}</text>
      `
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Lobby Market profile badge for @${esc(d.username)}">
  <title>@${esc(d.username)} on Lobby Market</title>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="14" fill="#111117"/>
  <rect width="${W}" height="${H}" rx="14" fill="none" stroke="#24242e" stroke-width="1"/>

  <!-- Accent stripe (left edge) -->
  <rect x="0" y="14" width="3" height="${H - 28}" rx="1.5" fill="${roleColor}"/>

  <!-- Avatar circle -->
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 3}" fill="${roleRing}" opacity="0.35"/>
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="#1a1a22" stroke="${roleRing}" stroke-width="2"/>
  <text x="${avatarCx}" y="${avatarCy + 7}" font-family="ui-monospace,monospace"
    font-size="22" font-weight="800" fill="${roleColor}" text-anchor="middle">${esc(initials)}</text>

  <!-- Name -->
  <text x="122" y="28" font-family="ui-sans-serif,system-ui,sans-serif"
    font-size="15" font-weight="700" fill="#fafafa">${esc(d.displayName.slice(0, 28))}${d.displayName.length > 28 ? '…' : ''}</text>

  <!-- @username + role -->
  <text x="122" y="43" font-family="ui-monospace,monospace"
    font-size="10.5" font-weight="500" fill="#71717a">@${esc(d.username)}</text>
  <rect x="${122 + 7.5 * (d.username.length + 1) + 14}" y="32" width="${roleLabel.length * 6.5 + 8}" height="14" rx="4"
    fill="${roleColor}22" stroke="${roleColor}55" stroke-width="1"/>
  <text x="${122 + 7.5 * (d.username.length + 1) + 18}" y="42.5" font-family="ui-monospace,monospace"
    font-size="8" font-weight="700" fill="${roleColor}">${esc(roleLabel.toUpperCase())}</text>

  <!-- Stat boxes -->
  ${statBoxes}

  <!-- Lobby Market branding (bottom right) -->
  <text x="${W - 10}" y="${H - 10}" font-family="ui-monospace,monospace"
    font-size="8" font-weight="600" fill="#3f3f4a" text-anchor="end">lobby.market</text>
</svg>`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const username = params.username.replace(/\.svg$/i, '')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, role, clout, reputation_score, total_votes, vote_streak')
    .eq('username', username)
    .maybeSingle()

  const svg = buildSvg({
    username,
    displayName: profile?.display_name || profile?.username || username,
    role: profile?.role ?? 'person',
    clout: profile?.clout ?? 0,
    totalVotes: profile?.total_votes ?? 0,
    repScore: profile?.reputation_score ?? 0,
    voteStreak: profile?.vote_streak ?? 0,
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
