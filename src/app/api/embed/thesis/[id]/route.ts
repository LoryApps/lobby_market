import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Revalidate every 60 s — thesis agreement counts change moderately
export const revalidate = 60

const BASE_URL = 'https://lobby.market'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function timeUntil(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'resolves soon'
  if (h < 24) return `${h}h left`
  if (d > 365) return null
  return `${d}d left`
}

// ─── Status styling ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  bg: string
  color: string
  border: string
  dot: string
}

function getStatus(status: string): StatusConfig {
  const map: Record<string, StatusConfig> = {
    active:     { label: 'Active',     bg: 'rgba(37,99,235,.12)',  color: '#60a5fa', border: 'rgba(59,130,246,.35)',  dot: '#3b82f6' },
    vindicated: { label: 'Vindicated', bg: 'rgba(5,150,105,.12)',  color: '#34d399', border: 'rgba(16,185,129,.35)', dot: '#10b981' },
    refuted:    { label: 'Refuted',    bg: 'rgba(185,28,28,.12)',  color: '#f87171', border: 'rgba(239,68,68,.35)',  dot: '#ef4444' },
    expired:    { label: 'Expired',    bg: 'rgba(63,63,74,.12)',   color: '#a1a1aa', border: 'rgba(63,63,74,.35)',   dot: '#71717a' },
  }
  return map[status] ?? map.active
}

// ─── Category accent ───────────────────────────────────────────────────────────

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    economics:   '#f59e0b',
    politics:    '#3b82f6',
    technology:  '#8b5cf6',
    science:     '#10b981',
    ethics:      '#f87171',
    philosophy:  '#8b5cf6',
    culture:     '#f59e0b',
    health:      '#10b981',
    environment: '#10b981',
    education:   '#60a5fa',
  }
  return map[cat] ?? '#71717a'
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    economics:   'Economics',
    politics:    'Politics',
    technology:  'Technology',
    science:     'Science',
    ethics:      'Ethics',
    philosophy:  'Philosophy',
    culture:     'Culture',
    health:      'Health',
    environment: 'Environment',
    education:   'Education',
  }
  return map[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1)
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function errorHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#111117;color:#52525b;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:6px;padding:16px}a{color:#3b82f6;font-size:11px;text-decoration:none}p{font-size:13px}</style>
</head><body><p>Thesis not found.</p><a href="${BASE_URL}/thesis" target="_blank" rel="noopener">Browse Civic Theses &rsaquo;</a></body></html>`
}

function widgetHtml(p: {
  id: string
  statement: string
  category: string
  status: string
  agreePct: number
  agreeCount: number
  disagreeCount: number
  countdown: string | null
  authorUsername: string | null
  authorDisplayName: string | null
}): string {
  const { id, statement, category, status, agreePct, agreeCount, disagreeCount, countdown, authorUsername, authorDisplayName } = p
  const disagreePct = 100 - agreePct
  const total = agreeCount + disagreeCount
  const st = getStatus(status)
  const catColor = getCategoryColor(category)
  const catLabel = getCategoryLabel(category)
  const thesisUrl = `${BASE_URL}/thesis/${esc(id)}`
  const shareUrl  = `${BASE_URL}/share/thesis/${esc(id)}`
  const safeStmt = esc(statement.length > 200 ? statement.slice(0, 199) + '…' : statement)
  const totalLabel = fmtCount(total) + (total === 1 ? ' vote' : ' votes')

  // Ensure bar segments are never invisibly thin
  const agreeW = agreePct > 0 && agreePct < 3 ? 3 : agreePct
  const disW   = disagreePct > 0 && disagreePct < 3 ? 3 : disagreePct

  const isVindicated = status === 'vindicated'
  const isRefuted    = status === 'refuted'
  const ctaText = isVindicated ? 'View resolution &rsaquo;' : isRefuted ? 'View outcome &rsaquo;' : 'Agree or disagree &rsaquo;'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(statement.slice(0, 70))} · Civic Thesis · Lobby Market</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100%;background:#0d1117;padding:3px;display:flex;align-items:stretch}
.card{flex:1;display:flex;flex-direction:column;background:#111318;border:1px solid #24242e;border-radius:12px;padding:16px;gap:12px;overflow:hidden;position:relative}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${catColor};border-radius:12px 12px 0 0;opacity:.7}
.top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.badges{display:flex;gap:6px;flex-wrap:wrap;min-width:0}
.status-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:${st.bg};color:${st.color};border:1px solid ${st.border}}
.status-dot{width:5px;height:5px;border-radius:50%;background:${st.dot};flex-shrink:0}
.cat-badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;color:${catColor};background:${catColor}1a;border:1px solid ${catColor}3d}
.lm-link{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#3f3f4a;text-decoration:none;flex-shrink:0;white-space:nowrap}
.lm-link:hover{color:#71717a}
.quote{font-size:13px;font-weight:600;color:#fafafa;line-height:1.5;letter-spacing:.01em;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.bar-section{display:flex;flex-direction:column;gap:5px}
.bar-labels{display:flex;justify-content:space-between;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
.agree-label{color:#34d399}
.disagree-label{color:#f87171}
.vote-count{font-size:10px;color:#52525b;font-variant-numeric:tabular-nums}
.bar{height:6px;border-radius:9999px;background:#24242e;overflow:hidden;display:flex}
.bar-agree{height:100%;background:linear-gradient(90deg,#059669,#10b981);border-radius:9999px 0 0 9999px;transition:width .3s ease}
.bar-disagree{height:100%;background:linear-gradient(270deg,#b91c1c,#ef4444);border-radius:0 9999px 9999px 0;transition:width .3s ease}
.meta{display:flex;align-items:center;justify-content:space-between;gap:8px}
.author{font-size:10px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.author b{color:#a1a1aa;font-weight:600}
.countdown{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:9999px;background:rgba(37,99,235,.1);border:1px solid rgba(59,130,246,.2);font-size:9px;font-weight:600;color:#60a5fa;white-space:nowrap;flex-shrink:0}
.cta{display:block;text-align:center;padding:8px 12px;background:rgba(37,99,235,.15);border:1px solid rgba(59,130,246,.3);border-radius:8px;font-size:11px;font-weight:700;color:#60a5fa;text-decoration:none;letter-spacing:.03em;transition:background .15s}
.cta:hover{background:rgba(37,99,235,.25)}
</style>
</head>
<body>
<div class="card">
  <div class="top">
    <div class="badges">
      <span class="status-badge"><span class="status-dot"></span>${st.label}</span>
      <span class="cat-badge">${esc(catLabel)}</span>
    </div>
    <a href="${BASE_URL}" target="_blank" rel="noopener" class="lm-link">LOBBY MARKET</a>
  </div>
  <p class="quote">&ldquo;${safeStmt}&rdquo;</p>
  <div class="bar-section">
    <div class="bar-labels">
      <span class="agree-label">${agreePct}% Agree</span>
      <span class="vote-count">${totalLabel}</span>
      <span class="disagree-label">${disagreePct}% Disagree</span>
    </div>
    <div class="bar">
      <div class="bar-agree" style="width:${agreeW}%"></div>
      <div class="bar-disagree" style="width:${disW}%"></div>
    </div>
  </div>
  <div class="meta">
    ${authorUsername
      ? `<span class="author">by <b>${esc(authorDisplayName || authorUsername)}</b> <span style="color:#3f3f4a">@${esc(authorUsername)}</span></span>`
      : '<span></span>'
    }
    ${countdown ? `<span class="countdown">⏳ ${esc(countdown)}</span>` : ''}
  </div>
  <a href="${thesisUrl}" target="_blank" rel="noopener" class="cta">${ctaText}</a>
</div>
</body>
</html>`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: thesis } = await supabase
    .from('civic_theses')
    .select('id, user_id, statement, category, status, agree_count, disagree_count, resolution_date, is_public')
    .eq('id', params.id)
    .eq('is_public', true)
    .maybeSingle()

  if (!thesis) {
    return new NextResponse(errorHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { data: author } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', thesis.user_id)
    .maybeSingle()

  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50

  const countdown =
    thesis.status === 'active' && thesis.resolution_date
      ? timeUntil(thesis.resolution_date)
      : null

  const html = widgetHtml({
    id:              thesis.id,
    statement:       thesis.statement,
    category:        thesis.category,
    status:          thesis.status,
    agreePct,
    agreeCount:      thesis.agree_count,
    disagreeCount:   thesis.disagree_count,
    countdown,
    authorUsername:  author?.username ?? null,
    authorDisplayName: author?.display_name ?? null,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  })
}
