import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Revalidate every 2 minutes — profile data changes infrequently
export const revalidate = 120

const BASE_URL = 'https://lobby.market'

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

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
  admin: 'Admin',
}

const ROLE_COLOR: Record<string, string> = {
  person: '#6b7280',
  debator: '#3b82f6',
  troll_catcher: '#10b981',
  elder: '#f59e0b',
  lawmaker: '#8b5cf6',
  senator: '#f59e0b',
  admin: '#ef4444',
}

function errorHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#52525b;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:8px;padding:16px;text-align:center}a{color:#3b82f6;font-size:11px;text-decoration:none}p{font-size:13px;color:#71717a}</style>
</head><body><p>Profile not found.</p><a href="${esc(BASE_URL)}" target="_blank" rel="noopener">Lobby Market</a></body></html>`
}

interface ProfileData {
  username: string
  display_name: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  blue_vote_count: number
  red_vote_count: number
  vote_streak: number
  followers_count: number
  civic_archetype: string | null
  created_at: string
}

function widgetHtml(p: ProfileData): string {
  const forPct = p.total_votes > 0
    ? Math.round((p.blue_vote_count / p.total_votes) * 100)
    : 50
  const againstPct = 100 - forPct

  const roleLabel = ROLE_LABEL[p.role] ?? p.role
  const roleColor = ROLE_COLOR[p.role] ?? '#6b7280'

  const memberYear = new Date(p.created_at).getFullYear()

  const bioHtml = p.bio
    ? `<p style="font-size:12px;color:#71717a;line-height:1.5;margin-top:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.bio)}</p>`
    : ''

  const archetypeHtml = p.civic_archetype
    ? `<span style="font-size:10px;color:#a855f7;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);padding:2px 8px;border-radius:999px;font-family:monospace">${esc(p.civic_archetype)}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(p.display_name ?? p.username)} · Lobby Market</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:system-ui,-apple-system,sans-serif;
      background:#0a0a0f;
      color:#e4e4e7;
      height:100vh;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    }
    .card{
      flex:1;
      display:flex;
      flex-direction:column;
      padding:20px;
      border:1px solid rgba(255,255,255,0.08);
      border-radius:0;
      position:relative;
      overflow:hidden;
    }
    .card::before{
      content:'';
      position:absolute;
      inset:0;
      background:radial-gradient(ellipse 80% 60% at 50% -20%,rgba(59,130,246,0.06),transparent);
      pointer-events:none;
    }
    .header{
      display:flex;
      align-items:flex-start;
      gap:12px;
    }
    .avatar-wrap{
      flex-shrink:0;
    }
    .avatar{
      width:48px;
      height:48px;
      border-radius:50%;
      background:linear-gradient(135deg,#1d4ed8,#7c3aed);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:20px;
      font-weight:700;
      color:#fff;
      border:2px solid rgba(255,255,255,0.1);
    }
    .info{flex:1;min-width:0}
    .name{
      font-size:16px;
      font-weight:700;
      color:#f4f4f5;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .username{
      font-size:12px;
      color:#71717a;
      font-family:monospace;
      margin-top:2px;
    }
    .badges{
      display:flex;
      align-items:center;
      gap:6px;
      margin-top:8px;
      flex-wrap:wrap;
    }
    .role-badge{
      font-size:10px;
      font-family:monospace;
      font-weight:600;
      padding:2px 8px;
      border-radius:999px;
      border:1px solid;
      letter-spacing:0.05em;
    }
    .stats{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin-top:14px;
    }
    .stat{
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:8px;
      padding:8px 6px;
      text-align:center;
    }
    .stat-value{
      font-size:15px;
      font-weight:700;
      color:#f4f4f5;
      font-family:monospace;
    }
    .stat-label{
      font-size:10px;
      color:#71717a;
      margin-top:2px;
      text-transform:uppercase;
      letter-spacing:0.05em;
    }
    .vote-bar-wrap{margin-top:14px}
    .vote-bar-labels{
      display:flex;
      justify-content:space-between;
      font-size:11px;
      margin-bottom:4px;
    }
    .vote-bar-track{
      height:6px;
      border-radius:999px;
      background:rgba(255,255,255,0.08);
      overflow:hidden;
      display:flex;
    }
    .vote-bar-for{
      height:100%;
      background:linear-gradient(90deg,#1d4ed8,#3b82f6);
      border-radius:999px 0 0 999px;
    }
    .vote-bar-against{
      height:100%;
      background:linear-gradient(90deg,#ef4444,#dc2626);
      border-radius:0 999px 999px 0;
    }
    .footer{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-top:auto;
      padding-top:12px;
      border-top:1px solid rgba(255,255,255,0.06);
    }
    .footer-left{font-size:10px;color:#52525b;font-family:monospace}
    .footer-link{
      font-size:10px;
      color:#3b82f6;
      text-decoration:none;
      font-family:monospace;
      opacity:0.7;
    }
    .footer-link:hover{opacity:1}
    .streak{
      display:flex;
      align-items:center;
      gap:4px;
      font-size:11px;
      color:#f59e0b;
      font-family:monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="avatar-wrap">
        <div class="avatar">${esc((p.display_name ?? p.username).charAt(0).toUpperCase())}</div>
      </div>
      <div class="info">
        <div class="name">${esc(p.display_name ?? p.username)}</div>
        <div class="username">@${esc(p.username)}</div>
        <div class="badges">
          <span class="role-badge" style="color:${esc(roleColor)};border-color:${esc(roleColor)}40;background:${esc(roleColor)}12">${esc(roleLabel)}</span>
          ${archetypeHtml}
          ${p.vote_streak > 0 ? `<span class="streak">&#128293; ${p.vote_streak}d streak</span>` : ''}
        </div>
      </div>
    </div>

    ${bioHtml}

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${esc(fmtNumber(p.clout))}</div>
        <div class="stat-label">Clout</div>
      </div>
      <div class="stat">
        <div class="stat-value">${esc(fmtNumber(p.total_votes))}</div>
        <div class="stat-label">Votes</div>
      </div>
      <div class="stat">
        <div class="stat-value">${esc(fmtNumber(p.total_arguments))}</div>
        <div class="stat-label">Arguments</div>
      </div>
    </div>

    ${p.total_votes > 0 ? `
    <div class="vote-bar-wrap">
      <div class="vote-bar-labels">
        <span style="color:#3b82f6;font-weight:600">${forPct}% For</span>
        <span style="color:#71717a;font-size:10px">${esc(fmtNumber(p.followers_count))} followers</span>
        <span style="color:#ef4444;font-weight:600">${againstPct}% Against</span>
      </div>
      <div class="vote-bar-track">
        <div class="vote-bar-for" style="width:${forPct}%"></div>
        <div class="vote-bar-against" style="width:${againstPct}%"></div>
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <span class="footer-left">Citizen since ${memberYear}</span>
      <a class="footer-link" href="${esc(BASE_URL)}/profile/${esc(p.username)}" target="_blank" rel="noopener">View on Lobby Market &#8599;</a>
    </div>
  </div>
</body>
</html>`
}

export async function GET(
  _req: Request,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      username,
      display_name,
      bio,
      role,
      clout,
      reputation_score,
      total_votes,
      total_arguments,
      blue_vote_count,
      red_vote_count,
      vote_streak,
      followers_count,
      civic_archetype,
      created_at
    `)
    .eq('username', params.username)
    .maybeSingle()

  const html = profile ? widgetHtml(profile as ProfileData) : errorHtml()

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      // Allow any site to embed this widget in an iframe
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *",
    },
  })
}
