import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'CITIZEN',
  debator: 'DEBATOR',
  troll_catcher: 'TROLL CATCHER',
  elder: 'ELDER',
}

const ROLE_COLOR: Record<string, string> = {
  person: '#71717a',
  debator: '#3b82f6',
  troll_catcher: '#10b981',
  elder: '#f59e0b',
}

const ROLE_BG: Record<string, string> = {
  person: 'rgba(113,113,122,0.15)',
  debator: 'rgba(59,130,246,0.15)',
  troll_catcher: 'rgba(16,185,129,0.15)',
  elder: 'rgba(245,158,11,0.15)',
}

// ── Number formatting ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ── Escape XML special chars ──────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── SVG builder ───────────────────────────────────────────────────────────────

function buildSVG(params: {
  username: string
  displayName: string | null
  role: string
  totalVotes: number
  totalArguments: number
  clout: number
  voteStreak: number
  reputationScore: number
  style: 'default' | 'compact' | 'minimal'
}): string {
  const { username, displayName, role, totalVotes, totalArguments, clout, voteStreak, reputationScore, style } = params

  const roleLabel = ROLE_LABEL[role] ?? 'CITIZEN'
  const roleColor = ROLE_COLOR[role] ?? '#71717a'
  const roleBg = ROLE_BG[role] ?? 'rgba(113,113,122,0.15)'
  const displayedName = displayName || `@${username}`

  if (style === 'compact') {
    // shields.io-style compact badge (340 × 20)
    const label = 'lobby market'
    const value = `@${username} · ${fmt(totalVotes)} votes`
    const labelW = 114
    const valueW = 220
    const totalW = labelW + valueW
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="Lobby Market: ${esc(value)}">
  <title>Lobby Market: ${esc(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalW}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#555"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${roleColor}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text x="${labelW / 2 * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelW - 10) * 10}" lengthAdjust="spacing">${esc(label)}</text>
    <text x="${labelW / 2 * 10}" y="140" transform="scale(.1)" textLength="${(labelW - 10) * 10}" lengthAdjust="spacing">${esc(label)}</text>
    <text x="${(labelW + valueW / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueW - 10) * 10}" lengthAdjust="spacing">${esc(value)}</text>
    <text x="${(labelW + valueW / 2) * 10}" y="140" transform="scale(.1)" textLength="${(valueW - 10) * 10}" lengthAdjust="spacing">${esc(value)}</text>
  </g>
</svg>`
  }

  if (style === 'minimal') {
    // Clean minimal card (500 × 80)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="80" viewBox="0 0 500 80">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#111117"/>
      <stop offset="100%" style="stop-color:#0a0a0f"/>
    </linearGradient>
    <clipPath id="clip"><rect width="500" height="80" rx="10"/></clipPath>
  </defs>
  <rect width="500" height="80" rx="10" fill="url(#bg)"/>
  <rect width="500" height="80" rx="10" fill="none" stroke="${roleColor}" stroke-opacity="0.3" stroke-width="1"/>
  <g clip-path="url(#clip)">
    <rect x="0" y="0" width="4" height="80" fill="${roleColor}"/>
  </g>
  <!-- LM mark -->
  <text x="22" y="30" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="${roleColor}" letter-spacing="1">LM</text>
  <text x="22" y="46" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="2">LOBBY MARKET</text>
  <!-- Username -->
  <text x="100" y="30" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#ffffff">${esc(displayedName)}</text>
  <text x="100" y="48" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="${roleColor}" letter-spacing="1">${esc(roleLabel)}</text>
  <!-- Stats -->
  <text x="340" y="30" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(fmt(totalVotes))}</text>
  <text x="340" y="46" font-family="system-ui,sans-serif" font-size="9" font-weight="500" fill="#71717a" text-anchor="middle">VOTES</text>
  <line x1="370" y1="24" x2="370" y2="52" stroke="#24242e" stroke-width="1"/>
  <text x="440" y="30" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="${roleColor}" text-anchor="middle">${esc(fmt(clout))}</text>
  <text x="440" y="46" font-family="system-ui,sans-serif" font-size="9" font-weight="500" fill="#71717a" text-anchor="middle">CLOUT</text>
  <!-- Domain -->
  <text x="22" y="68" font-family="system-ui,sans-serif" font-size="8" fill="#3f3f4a">lobby.market/@${esc(username)}</text>
</svg>`
  }

  // Default full card (500 × 120)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="120" viewBox="0 0 500 120">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a22"/>
      <stop offset="100%" style="stop-color:#0a0a0f"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${roleColor};stop-opacity:0.6"/>
      <stop offset="100%" style="stop-color:${roleColor};stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="500" height="120" rx="12" fill="url(#bg)"/>
  <rect width="500" height="120" rx="12" fill="none" stroke="${roleColor}" stroke-opacity="0.25" stroke-width="1"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="500" height="3" rx="12" fill="url(#accentGrad)"/>

  <!-- Left panel background -->
  <rect x="0" y="0" width="90" height="120" rx="12" fill="rgba(0,0,0,0.3)"/>
  <rect x="88" y="0" width="1" height="120" fill="#24242e"/>

  <!-- LM monogram -->
  <text x="45" y="52" font-family="'Georgia',serif" font-size="28" font-weight="900" fill="${roleColor}" text-anchor="middle">LM</text>
  <text x="45" y="68" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#71717a" text-anchor="middle" letter-spacing="2">LOBBY</text>
  <text x="45" y="78" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#71717a" text-anchor="middle" letter-spacing="2">MARKET</text>

  <!-- Username -->
  <text x="108" y="38" font-family="system-ui,sans-serif" font-size="20" font-weight="800" fill="#ffffff">${esc(displayedName)}</text>
  ${displayName ? `<text x="108" y="54" font-family="system-ui,sans-serif" font-size="11" font-weight="500" fill="#71717a">@${esc(username)}</text>` : ''}

  <!-- Role badge -->
  <rect x="108" y="${displayName ? 62 : 48}" width="${roleLabel.length * 7 + 16}" height="18" rx="4" fill="${roleBg}"/>
  <rect x="108" y="${displayName ? 62 : 48}" width="${roleLabel.length * 7 + 16}" height="18" rx="4" fill="none" stroke="${roleColor}" stroke-opacity="0.4" stroke-width="0.75"/>
  <text x="116" y="${displayName ? 74 : 60}" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="${roleColor}" letter-spacing="0.5">${esc(roleLabel)}</text>

  <!-- Stats row -->
  <!-- Votes -->
  <text x="108" y="102" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#ffffff">${esc(fmt(totalVotes))}</text>
  <text x="108" y="114" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="1">VOTES</text>

  <!-- Divider -->
  <line x1="168" y1="94" x2="168" y2="114" stroke="#24242e" stroke-width="1"/>

  <!-- Arguments -->
  <text x="178" y="102" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#ffffff">${esc(fmt(totalArguments))}</text>
  <text x="178" y="114" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="1">ARGUMENTS</text>

  <!-- Divider -->
  <line x1="260" y1="94" x2="260" y2="114" stroke="#24242e" stroke-width="1"/>

  <!-- Clout -->
  <text x="270" y="102" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="${roleColor}">${esc(fmt(clout))}</text>
  <text x="270" y="114" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="1">CLOUT</text>

  <!-- Divider -->
  <line x1="330" y1="94" x2="330" y2="114" stroke="#24242e" stroke-width="1"/>

  <!-- Streak -->
  <text x="340" y="102" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="${voteStreak >= 7 ? '#f59e0b' : '#ffffff'}">${voteStreak}</text>
  <text x="340" y="114" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="1">${voteStreak === 1 ? 'DAY STREAK' : 'DAY STREAK'}</text>

  <!-- Divider -->
  <line x1="410" y1="94" x2="410" y2="114" stroke="#24242e" stroke-width="1"/>

  <!-- Reputation -->
  <text x="420" y="102" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#ffffff">${esc(fmt(reputationScore))}</text>
  <text x="420" y="114" font-family="system-ui,sans-serif" font-size="8" font-weight="600" fill="#71717a" letter-spacing="1">REP</text>

  <!-- Domain -->
  <text x="489" y="18" font-family="system-ui,sans-serif" font-size="9" fill="#3f3f4a" text-anchor="end">lobby.market</text>
</svg>`
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params
  const style = (req.nextUrl.searchParams.get('style') ?? 'default') as 'default' | 'compact' | 'minimal'

  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username, display_name, role, total_votes, total_arguments, clout, vote_streak, reputation_score')
    .eq('username', username)
    .maybeSingle()

  if (error || !profile) {
    return new NextResponse(
      buildSVG({
        username,
        displayName: null,
        role: 'person',
        totalVotes: 0,
        totalArguments: 0,
        clout: 0,
        voteStreak: 0,
        reputationScore: 0,
        style,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }
    )
  }

  const svg = buildSVG({
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    totalVotes: profile.total_votes,
    totalArguments: profile.total_arguments,
    clout: profile.clout,
    voteStreak: profile.vote_streak,
    reputationScore: profile.reputation_score,
    style,
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  })
}
