import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'PROPOSED',
  active: 'ACTIVE',
  voting: 'VOTING',
  law: 'ESTABLISHED LAW',
  failed: 'FAILED',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: '#6b7280',
  active: '#10b981',
  voting: '#f59e0b',
  law: '#c9a84c',
  failed: '#6b7280',
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/embed/topic/[id]
 *
 * Returns a fully self-contained HTML document designed to be embedded as an
 * <iframe> on any external website.  The widget shows the topic statement,
 * a FOR / AGAINST vote bar, and a CTA link back to the full debate.
 *
 * Security note: the /api/embed/* path has X-Frame-Options removed and
 * Content-Security-Policy: frame-ancestors * added in next.config.mjs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:16px;color:#71717a;font-size:13px">Topic not found.</body></html>`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    )
  }

  const forPct = Math.max(0, Math.min(100, Math.round(topic.blue_pct ?? 50)))
  const againstPct = 100 - forPct
  const totalVotes: number = topic.total_votes ?? 0
  const status: string = topic.status ?? 'proposed'
  const category: string | null = topic.category ?? null

  const statusLabel = STATUS_LABEL[status] ?? status.toUpperCase()
  const statusColor = STATUS_COLOR[status] ?? '#6b7280'

  // Truncate long statements so the widget stays compact
  const rawStatement: string = topic.statement ?? ''
  const statement =
    rawStatement.length > 160
      ? rawStatement.slice(0, 157) + '\u2026'
      : rawStatement

  const topicUrl = `https://lobby.market/topic/${escHtml(topic.id)}`
  const lobbyUrl = 'https://lobby.market'

  // Bar widths — ensure the visual fills at least 2px so it's always visible
  const forW = Math.max(forPct, forPct > 0 ? 2 : 0)
  const agW = Math.max(againstPct, againstPct > 0 ? 2 : 0)

  const voteLabel =
    totalVotes === 0
      ? 'No votes yet'
      : `${totalVotes.toLocaleString('en-US')} vote${totalVotes === 1 ? '' : 's'}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lobby Market – Vote Widget</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: transparent;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      padding: 4px;
    }

    .widget {
      background: #111117;
      border: 1px solid #24242e;
      border-radius: 14px;
      padding: 18px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── Top row: status badge + category ─────────── */
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .status {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: ${statusColor};
      text-transform: uppercase;
    }

    .category {
      font-size: 10px;
      color: #52525b;
      letter-spacing: 0.03em;
    }

    /* ── Statement ────────────────────────────────── */
    .statement {
      font-size: 13.5px;
      line-height: 1.55;
      color: #e4e4e7;
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    /* ── Vote bar ─────────────────────────────────── */
    .bar-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bar {
      display: flex;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #1a1a22;
    }

    .bar-for {
      height: 100%;
      width: ${forW}%;
      background: linear-gradient(90deg, #1d4ed8, #3b82f6);
      border-radius: 999px 0 0 999px;
      transition: width 0.4s ease;
    }

    .bar-against {
      height: 100%;
      width: ${agW}%;
      background: linear-gradient(90deg, #ef4444, #dc2626);
      border-radius: 0 999px 999px 0;
      margin-left: auto;
      transition: width 0.4s ease;
    }

    .bar-labels {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .bar-label-for {
      font-size: 12px;
      font-weight: 700;
      color: #60a5fa;
      letter-spacing: -0.01em;
    }

    .bar-label-votes {
      font-size: 11px;
      color: #52525b;
    }

    .bar-label-against {
      font-size: 12px;
      font-weight: 700;
      color: #f87171;
      letter-spacing: -0.01em;
    }

    /* ── CTA button ───────────────────────────────── */
    .cta {
      display: block;
      background: #1a1a22;
      border: 1px solid #2e2e38;
      border-radius: 10px;
      padding: 10px 14px;
      text-align: center;
      text-decoration: none;
      color: #60a5fa;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      transition: background 0.15s, border-color 0.15s;
    }

    .cta:hover {
      background: #24242e;
      border-color: #3b82f6;
    }

    /* ── Attribution ──────────────────────────────── */
    .attribution {
      text-align: center;
    }

    .attribution a {
      font-size: 10px;
      color: #3f3f4a;
      text-decoration: none;
      letter-spacing: 0.04em;
    }

    .attribution a:hover {
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="widget">

    <!-- Status + category -->
    <div class="meta">
      <span class="status">${escHtml(statusLabel)}</span>
      ${category ? `<span class="category">${escHtml(category)}</span>` : ''}
    </div>

    <!-- Topic statement -->
    <p class="statement">${escHtml(statement)}</p>

    <!-- Vote bar -->
    <div class="bar-wrap">
      <div class="bar">
        <div class="bar-for"></div>
        <div class="bar-against"></div>
      </div>
      <div class="bar-labels">
        <span class="bar-label-for">${forPct}% For</span>
        <span class="bar-label-votes">${escHtml(voteLabel)}</span>
        <span class="bar-label-against">${againstPct}% Against</span>
      </div>
    </div>

    <!-- CTA -->
    <a class="cta" href="${topicUrl}" target="_blank" rel="noopener noreferrer">
      Vote on Lobby Market &rsaquo;
    </a>

    <!-- Attribution -->
    <div class="attribution">
      <a href="${lobbyUrl}" target="_blank" rel="noopener noreferrer">
        Powered by Lobby Market
      </a>
    </div>

  </div>

  <script>
    // Notify parent page of rendered height so it can resize the iframe
    function sendHeight() {
      var h = document.querySelector('.widget').offsetHeight + 8;
      window.parent.postMessage({ type: 'lobby-embed-resize', height: h }, '*');
    }
    if (document.readyState === 'complete') {
      sendHeight();
    } else {
      window.addEventListener('load', sendHeight);
    }
  </script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
