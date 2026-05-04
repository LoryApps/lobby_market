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

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'PROPOSED',
  active: 'ACTIVE',
  voting: 'VOTING',
  law: 'LAW',
  failed: 'FAILED',
  continued: 'CONTINUED',
  archived: 'ARCHIVED',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: '#71717a',
  active: '#3b82f6',
  voting: '#8b5cf6',
  law: '#c9a84c',
  failed: '#ef4444',
  continued: '#6b7280',
  archived: '#6b7280',
}

// ─── Category accent colours ───────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: '#c9a84c',
  Politics: '#3b82f6',
  Technology: '#8b5cf6',
  Science: '#10b981',
  Ethics: '#ef4444',
  Philosophy: '#6366f1',
  Culture: '#f59e0b',
  Health: '#f97316',
  Environment: '#22c55e',
  Education: '#8b5cf6',
}

// ─── SVG badge builder ─────────────────────────────────────────────────────────

interface TopicBadgeData {
  id: string
  statement: string
  category: string | null
  status: string
  forPct: number
  totalVotes: number
}

function buildSvg(d: TopicBadgeData): string {
  const W = 440
  const H = 120

  const statusLabel = STATUS_LABEL[d.status] ?? d.status.toUpperCase()
  const statusColor = STATUS_COLOR[d.status] ?? '#71717a'
  const categoryColor = CATEGORY_COLOR[d.category ?? ''] ?? '#71717a'

  const againstPct = 100 - d.forPct
  const forBarW = Math.round((d.forPct / 100) * (W - 32))
  const againstBarW = (W - 32) - forBarW

  // Truncate statement to fit badge width (approx 50 chars per line, 2 lines)
  const MAX_CHARS = 72
  const stmt = d.statement.length > MAX_CHARS
    ? d.statement.slice(0, MAX_CHARS - 1) + '…'
    : d.statement

  // Wrap text into two lines of ~36 chars each
  const words = stmt.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= 38) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
    if (lines.length === 2) {
      // already have two full lines — append remaining to second
      lines[1] = (lines[1] + ' ' + current).trim().slice(0, 38)
      current = ''
      break
    }
  }
  if (current && lines.length < 2) lines.push(current)

  const line1 = esc(lines[0] ?? '')
  const line2 = esc(lines[1] ?? '')
  const hasLine2 = line2.length > 0

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Lobby Market debate badge: ${esc(d.statement)}">
  <title>${esc(d.statement)}</title>

  <!-- Background -->
  <rect width="${W}" height="${H}" rx="14" fill="#111117"/>
  <rect width="${W}" height="${H}" rx="14" fill="none" stroke="#24242e" stroke-width="1"/>

  <!-- Left accent stripe (category color) -->
  <rect x="0" y="12" width="3" height="${H - 24}" rx="1.5" fill="${categoryColor}"/>

  <!-- Status pill -->
  <rect x="14" y="12" width="${statusLabel.length * 6.5 + 10}" height="16" rx="5"
    fill="${statusColor}22" stroke="${statusColor}55" stroke-width="1"/>
  <text x="19" y="23.5" font-family="ui-monospace,monospace"
    font-size="8.5" font-weight="700" fill="${statusColor}" letter-spacing="0.06em">${esc(statusLabel)}</text>

  <!-- Category pill -->
  ${d.category ? `
  <rect x="${14 + statusLabel.length * 6.5 + 18}" y="12" width="${(d.category.length * 6 + 10)}" height="16" rx="5"
    fill="${categoryColor}18" stroke="${categoryColor}44" stroke-width="1"/>
  <text x="${14 + statusLabel.length * 6.5 + 23}" y="23.5" font-family="ui-monospace,monospace"
    font-size="8.5" font-weight="600" fill="${categoryColor}" letter-spacing="0.04em">${esc(d.category.toUpperCase())}</text>
  ` : ''}

  <!-- Statement text -->
  <text x="14" y="${hasLine2 ? 46 : 50}" font-family="ui-sans-serif,system-ui,sans-serif"
    font-size="13.5" font-weight="600" fill="#f4f4f5">${line1}</text>
  ${hasLine2 ? `<text x="14" y="62" font-family="ui-sans-serif,system-ui,sans-serif"
    font-size="13.5" font-weight="600" fill="#f4f4f5">${line2}</text>` : ''}

  <!-- FOR / AGAINST split bar -->
  ${forBarW > 0 ? `<rect x="16" y="${H - 30}" width="${forBarW}" height="8" rx="4" fill="#3b82f6" opacity="0.85"/>` : ''}
  ${againstBarW > 0 ? `<rect x="${16 + forBarW}" y="${H - 30}" width="${againstBarW}" height="8" rx="4" fill="#ef4444" opacity="0.85"/>` : ''}

  <!-- FOR % label -->
  <text x="16" y="${H - 10}" font-family="ui-monospace,monospace"
    font-size="9.5" font-weight="700" fill="#3b82f6">${d.forPct}% FOR</text>

  <!-- AGAINST % label -->
  <text x="${W / 2}" y="${H - 10}" font-family="ui-monospace,monospace"
    font-size="9.5" font-weight="700" fill="#ef4444" text-anchor="middle">${againstPct}% AGAINST</text>

  <!-- Vote count -->
  <text x="${W - 14}" y="${H - 10}" font-family="ui-monospace,monospace"
    font-size="9.5" font-weight="600" fill="#52525b" text-anchor="end">${fmtNumber(d.totalVotes)} votes · lobby.market</text>
</svg>`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id.replace(/\.svg$/i, '')

  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  const forPct = Math.round((topic?.blue_pct ?? 50) * 10) / 10

  const svg = buildSvg({
    id,
    statement: topic?.statement ?? 'Lobby Market Debate',
    category: topic?.category ?? null,
    status: topic?.status ?? 'active',
    forPct,
    totalVotes: topic?.total_votes ?? 0,
  })

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
