import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Revalidate every 30 seconds — vote data changes frequently but we don't
// need per-request freshness for an embed widget.
export const revalidate = 30

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

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function fmtCountdown(endsAt: string | null): string | null {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 48) return `${Math.ceil(h / 24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

interface StatusConfig {
  label: string
  bg: string
  color: string
  border: string
  dot: string
}

function getStatus(status: string): StatusConfig {
  const map: Record<string, StatusConfig> = {
    active:   { label: 'Active',   bg: 'rgba(37,99,235,.12)',  color: '#60a5fa', border: 'rgba(59,130,246,.35)',  dot: '#3b82f6' },
    voting:   { label: 'Voting',   bg: 'rgba(109,40,217,.12)', color: '#a78bfa', border: 'rgba(139,92,246,.35)', dot: '#8b5cf6' },
    law:      { label: 'LAW',      bg: 'rgba(180,120,0,.12)',  color: '#fcd34d', border: 'rgba(245,158,11,.35)', dot: '#f59e0b' },
    proposed: { label: 'Proposed', bg: 'rgba(63,63,74,.12)',   color: '#a1a1aa', border: 'rgba(63,63,74,.35)',   dot: '#71717a' },
    failed:   { label: 'Failed',   bg: 'rgba(185,28,28,.12)',  color: '#f87171', border: 'rgba(239,68,68,.35)',  dot: '#ef4444' },
  }
  return map[status] ?? map.proposed
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function errorHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#111117;color:#52525b;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:6px;padding:16px}a{color:#3b82f6;font-size:11px;text-decoration:none}p{font-size:13px}</style>
</head><body><p>Topic not found.</p><a href="${BASE_URL}" target="_blank" rel="noopener">Lobby Market</a></body></html>`
}

function widgetHtml(p: {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  bluePct: number
  totalVotes: number
  countdown: string | null
}): string {
  const { id, statement, category, scope, status, bluePct, totalVotes, countdown } = p
  const redPct = 100 - bluePct
  const st = getStatus(status)
  const votesLabel = totalVotes === 0 ? 'No votes yet' : `${fmtVotes(totalVotes)} votes`
  const ctaText = status === 'law' ? 'View Law &rsaquo;' : 'Vote Now &rsaquo;'
  const topicUrl = `${BASE_URL}/topic/${esc(id)}`
  const safeStmt = esc(statement.length > 180 ? statement.slice(0, 179) + '\u2026' : statement)
  const metaParts = [category, scope !== 'Global' ? scope : null].filter(Boolean)
  const meta = metaParts.length ? esc(metaParts.join(' \u00b7 ')) : ''
  const isVoting = status === 'voting'
  const isLaw = status === 'law'

  // Ensure bar segments are never invisibly thin
  const forW = bluePct > 0 && bluePct < 3 ? 3 : bluePct
  const agnW = redPct > 0 && redPct < 3 ? 3 : redPct

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(statement.slice(0, 70))} \u00b7 Lobby Market</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{height:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100%;background:#0d1117;padding:3px;display:flex;align-items:stretch}

.card{
  flex:1;
  background:#111117;
  border:1px solid #1e2130;
  border-radius:14px;
  padding:16px 18px 14px;
  display:flex;
  flex-direction:column;
  gap:11px;
  position:relative;
  overflow:hidden;
}

/* subtle gradient sheen at top */
.card::before{
  content:'';
  position:absolute;
  inset:0;
  background:radial-gradient(ellipse 120% 60% at 50% -10%,rgba(59,130,246,.07),transparent 65%);
  pointer-events:none;
}

/* ── Header row ── */
.header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}

.brand{display:flex;align-items:center;gap:5px;text-decoration:none;opacity:.65;transition:opacity .15s}
.brand:hover{opacity:1}
.brand-pulse{width:6px;height:6px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,.7);flex-shrink:0}
.brand-text{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa}

.status-pill{
  display:flex;align-items:center;gap:4px;
  font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:2px 8px;border-radius:9999px;border:1px solid;
  white-space:nowrap;flex-shrink:0;
  background:${st.bg};color:${st.color};border-color:${st.border};
}
${isVoting ? `.dot-pulse{width:5px;height:5px;border-radius:50%;background:${st.dot};animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}` : ''}

/* ── Statement ── */
.statement{
  font-size:14px;font-weight:600;line-height:1.45;color:#e2e8f0;
  flex:1;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  word-break:break-word;
  letter-spacing:-.01em;
}

/* ── Vote bar ── */
.vote-section{flex-shrink:0}

.bar-track{
  height:6px;border-radius:9999px;
  background:#1a1a22;
  overflow:hidden;
  display:flex;
  margin-bottom:7px;
}
.bar-for{
  height:100%;width:${forW}%;
  background:linear-gradient(to right,#1d4ed8,#60a5fa);
  border-radius:9999px 0 0 9999px;
  ${bluePct === 100 ? 'border-radius:9999px;' : ''}
}
.bar-agn{
  height:100%;width:${agnW}%;
  background:linear-gradient(to left,#b91c1c,#f87171);
  border-radius:0 9999px 9999px 0;
  margin-left:auto;
  ${redPct === 100 ? 'margin-left:0;border-radius:9999px;' : ''}
}

.vote-labels{display:flex;align-items:center;justify-content:space-between}
.lbl-for{font-size:11.5px;font-weight:700;color:#60a5fa}
.lbl-total{font-size:10px;color:#52525b;font-weight:500}
.lbl-agn{font-size:11.5px;font-weight:700;color:#f87171}

/* ── Footer ── */
.footer{
  display:flex;align-items:center;justify-content:space-between;
  padding-top:9px;
  border-top:1px solid #1e2130;
  flex-shrink:0;
  gap:6px;
}

.footer-left{display:flex;flex-direction:column;gap:2px;overflow:hidden;min-width:0}
.footer-meta{font-size:10px;color:#3f3f4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${countdown ? `.countdown{font-size:10px;color:${isVoting ? '#a78bfa' : '#52525b'};font-weight:600}` : ''}

.cta{
  display:inline-flex;align-items:center;
  font-size:11px;font-weight:700;letter-spacing:.02em;
  color:${isLaw ? '#fcd34d' : '#60a5fa'};
  text-decoration:none;
  background:${isLaw ? 'rgba(245,158,11,.1)' : 'rgba(59,130,246,.1)'};
  border:1px solid ${isLaw ? 'rgba(245,158,11,.3)' : 'rgba(59,130,246,.3)'};
  padding:5px 11px;border-radius:8px;
  white-space:nowrap;
  transition:background .15s;
  flex-shrink:0;
}
.cta:hover{background:${isLaw ? 'rgba(245,158,11,.2)' : 'rgba(59,130,246,.2)'};}
</style>
</head>
<body>
<div class="card">

  <div class="header">
    <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer" class="brand">
      <div class="brand-pulse"></div>
      <span class="brand-text">Lobby Market</span>
    </a>
    <span class="status-pill">
      ${isVoting ? '<span class="dot-pulse"></span>' : ''}
      ${esc(st.label)}
    </span>
  </div>

  <p class="statement">${safeStmt}</p>

  <div class="vote-section">
    <div class="bar-track">
      <div class="bar-for"></div>
      <div class="bar-agn"></div>
    </div>
    <div class="vote-labels">
      <span class="lbl-for">${bluePct}% FOR</span>
      <span class="lbl-total">${esc(votesLabel)}</span>
      <span class="lbl-agn">${redPct}% AGN</span>
    </div>
  </div>

  <div class="footer">
    <div class="footer-left">
      ${meta ? `<span class="footer-meta">${meta}</span>` : ''}
      ${countdown ? `<span class="countdown">\u23f3 ${esc(countdown)}</span>` : ''}
    </div>
    <a href="${topicUrl}" target="_blank" rel="noopener noreferrer" class="cta">${ctaText}</a>
  </div>

</div>
<script>
(function(){
  function send(){
    var c=document.querySelector('.card');
    if(!c)return;
    var h=c.getBoundingClientRect().height+6;
    try{window.parent.postMessage({type:'lobby-embed-resize',height:Math.ceil(h)},'*');}catch(e){}
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',send);}else{send();}
  window.addEventListener('load',send);
  if(window.ResizeObserver){new ResizeObserver(send).observe(document.querySelector('.card'));}
})();
</script>
</body>
</html>`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse(errorHtml(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    const supabase = await createClient()
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, scope, status, blue_pct, total_votes, voting_ends_at')
      .eq('id', id)
      .single()

    if (!topic) {
      return new NextResponse(errorHtml(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const bluePct = Math.max(0, Math.min(100, Math.round(topic.blue_pct ?? 50)))
    const countdown = fmtCountdown(topic.voting_ends_at ?? null)

    const html = widgetHtml({
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      scope: topic.scope ?? 'Global',
      status: topic.status,
      bluePct,
      totalVotes: topic.total_votes,
      countdown,
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Edge cache: serve stale instantly, revalidate in background
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Vary': 'Accept-Encoding',
      },
    })
  } catch {
    return new NextResponse(errorHtml(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
