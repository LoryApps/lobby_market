import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

function errorHtml(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#111117;color:#52525b;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:6px;padding:16px}a{color:#3b82f6;font-size:11px;text-decoration:none}p{font-size:13px}</style>
</head><body><p>Argument not found.</p><a href="${BASE_URL}" target="_blank" rel="noopener">Lobby Market</a></body></html>`
}

interface WidgetParams {
  argId: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  authorName: string | null
  authorUsername: string | null
  topicId: string | null
  topicStatement: string | null
  topicStatus: string | null
  topicForPct: number
}

function widgetHtml(p: WidgetParams): string {
  const {
    argId,
    content,
    side,
    upvotes,
    authorName,
    authorUsername,
    topicId,
    topicStatement,
    topicStatus,
    topicForPct,
  } = p

  const isFor = side === 'blue'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const accentColor = isFor ? '#60a5fa' : '#f87171'
  const accentBg = isFor ? 'rgba(59,130,246,.12)' : 'rgba(239,68,68,.12)'
  const accentBorder = isFor ? 'rgba(59,130,246,.30)' : 'rgba(239,68,68,.30)'
  const glowColor = isFor ? 'rgba(59,130,246,.08)' : 'rgba(239,68,68,.07)'

  const topicForPctRounded = Math.round(topicForPct)
  const topicAgnPct = 100 - topicForPctRounded

  const argUrl = `${BASE_URL}/arguments/${esc(argId)}`
  const topicUrl = topicId ? `${BASE_URL}/topic/${esc(topicId)}` : BASE_URL

  const displayContent =
    content.length > 280 ? content.slice(0, 277) + '…' : content

  const topicStatusLabel: Record<string, string> = {
    active: 'Active',
    voting: 'Voting',
    law: 'LAW',
    proposed: 'Proposed',
    failed: 'Failed',
  }

  const topicStatusColor: Record<string, string> = {
    active: '#60a5fa',
    voting: '#a78bfa',
    law: '#fcd34d',
    proposed: '#a1a1aa',
    failed: '#f87171',
  }

  const tsc = topicStatus ? (topicStatusColor[topicStatus] ?? '#a1a1aa') : '#a1a1aa'
  const tsLabel = topicStatus ? (topicStatusLabel[topicStatus] ?? topicStatus) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(sideLabel + ': ' + content.slice(0, 60))} · Lobby Market</title>
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

.card::before{
  content:'';
  position:absolute;
  inset:0;
  background:radial-gradient(ellipse 100% 60% at 0% 0%,${glowColor},transparent 60%);
  pointer-events:none;
}

/* ── Header row ── */
.header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0}

.brand{display:flex;align-items:center;gap:5px;text-decoration:none;opacity:.6;transition:opacity .15s}
.brand:hover{opacity:1}
.brand-pulse{width:6px;height:6px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,.7);flex-shrink:0}
.brand-text{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa}

.side-pill{
  display:flex;align-items:center;gap:5px;
  font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  padding:2px 10px;border-radius:9999px;border:1px solid;
  white-space:nowrap;flex-shrink:0;
  background:${accentBg};color:${accentColor};border-color:${accentBorder};
}

.side-dot{width:5px;height:5px;border-radius:50%;background:${accentColor};flex-shrink:0}

/* ── Quote marks ── */
.quote-mark{
  font-size:32px;line-height:1;color:${accentColor};opacity:.25;
  font-family:Georgia,serif;margin-bottom:-8px;flex-shrink:0;
}

/* ── Argument content ── */
.argument{
  font-size:13.5px;font-weight:500;line-height:1.5;color:#e2e8f0;
  display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;
  word-break:break-word;
  letter-spacing:-.01em;
  font-style:italic;
}

/* ── Author row ── */
.author-row{
  display:flex;align-items:center;gap:8px;flex-shrink:0;
  font-size:11px;color:#52525b;
}
.author-name{font-weight:600;color:#71717a}
.upvotes{
  margin-left:auto;
  display:flex;align-items:center;gap:3px;
  font-size:11px;font-weight:700;color:${accentColor};
}

/* ── Topic row ── */
.topic-row{
  flex-shrink:0;
  background:#0d0f17;
  border:1px solid #1e2130;
  border-radius:9px;
  padding:9px 11px;
  display:flex;flex-direction:column;gap:5px;
}
.topic-meta{
  display:flex;align-items:center;gap:6px;
  font-size:10px;color:#3f3f4a;
  text-transform:uppercase;letter-spacing:.06em;
}
.topic-status{font-weight:700;color:${tsc}}
.topic-stmt{
  font-size:11.5px;font-weight:600;color:#a1a1aa;line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.topic-bar{
  display:flex;height:3px;border-radius:9999px;overflow:hidden;background:#1a1a22;gap:0;
}
.topic-bar-for{height:100%;background:#3b82f6;width:${topicForPctRounded}%}
.topic-bar-agn{height:100%;background:#ef4444;flex:1}

/* ── Footer ── */
.footer{
  display:flex;align-items:center;justify-content:space-between;
  padding-top:9px;
  border-top:1px solid #1e2130;
  flex-shrink:0;
  gap:6px;
}

.cta{
  display:inline-flex;align-items:center;gap:4px;
  font-size:11px;font-weight:700;letter-spacing:.02em;
  color:${accentColor};
  text-decoration:none;
  background:${accentBg};
  border:1px solid ${accentBorder};
  padding:5px 11px;border-radius:8px;
  white-space:nowrap;
  transition:background .15s;
  flex-shrink:0;
}
.cta:hover{opacity:.85}

.footer-label{font-size:10px;color:#3f3f4a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
</head>
<body>
<div class="card">

  <div class="header">
    <a href="${BASE_URL}" target="_blank" rel="noopener noreferrer" class="brand">
      <div class="brand-pulse"></div>
      <span class="brand-text">Lobby Market</span>
    </a>
    <span class="side-pill">
      <span class="side-dot"></span>
      ${esc(sideLabel)}
    </span>
  </div>

  <div class="quote-mark">“</div>

  <p class="argument">${esc(displayContent)}</p>

  <div class="author-row">
    ${authorName ? `<span class="author-name">${esc(authorName)}</span>` : ''}
    ${authorUsername && authorName !== authorUsername ? `<span>@${esc(authorUsername)}</span>` : ''}
    <span class="upvotes">
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      ${fmtVotes(upvotes)}
    </span>
  </div>

  ${topicStatement ? `
  <a href="${topicUrl}" target="_blank" rel="noopener noreferrer" class="topic-row" style="text-decoration:none">
    <div class="topic-meta">
      <span>On topic</span>
      ${tsLabel ? `<span>·</span><span class="topic-status">${esc(tsLabel)}</span>` : ''}
      <span>·</span>
      <span>${topicForPctRounded}% For</span>
      <span>/</span>
      <span>${topicAgnPct}% Agn</span>
    </div>
    <div class="topic-stmt">${esc(topicStatement)}</div>
    <div class="topic-bar">
      <div class="topic-bar-for"></div>
      <div class="topic-bar-agn"></div>
    </div>
  </a>` : ''}

  <div class="footer">
    <span class="footer-label">civic argument · lobby.market</span>
    <a href="${argUrl}" target="_blank" rel="noopener noreferrer" class="cta">
      Reply &rsaquo;
    </a>
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

    // Fetch the argument with its topic
    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, user_id, topic_id')
      .eq('id', id)
      .single()

    if (!arg) {
      return new NextResponse(errorHtml(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Fetch author and topic in parallel
    const [profileRes, topicRes] = await Promise.all([
      arg.user_id
        ? supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', arg.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      arg.topic_id
        ? supabase
            .from('topics')
            .select('id, statement, status, blue_pct')
            .eq('id', arg.topic_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const profile = profileRes.data
    const topic = topicRes.data

    const html = widgetHtml({
      argId: arg.id,
      content: arg.content,
      side: (arg.side as 'blue' | 'red') ?? 'blue',
      upvotes: arg.upvotes ?? 0,
      authorName: profile?.display_name ?? profile?.username ?? null,
      authorUsername: profile?.username ?? null,
      topicId: topic?.id ?? null,
      topicStatement: topic?.statement ?? null,
      topicStatus: topic?.status ?? null,
      topicForPct: Math.round(topic?.blue_pct ?? 50),
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
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
