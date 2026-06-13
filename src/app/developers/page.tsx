import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  Globe,
  Layers,
  Rss,
  Share2,
  Shield,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Developers · Lobby Market',
  description:
    'Embed live vote widgets, subscribe to the RSS feed, and integrate Lobby Market content into your site.',
  openGraph: {
    title: 'Developers · Lobby Market',
    description:
      'Public APIs for embedding, sharing, and integrating Lobby Market debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
          iconBg
        )}
      >
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <h2 className="font-mono text-lg font-bold text-white">{title}</h2>
        <p className="text-sm font-mono text-surface-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ─── Code block ───────────────────────────────────────────────────────────────

function CodeBlock({
  lang,
  code,
  label,
}: {
  lang: string
  code: string
  label?: string
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-surface-300 bg-surface-0">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-100 border-b border-surface-300">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-surface-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-surface-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-surface-400" />
        </div>
        <span className="text-[10px] font-mono text-surface-500 ml-1">
          {label ?? lang}
        </span>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed font-mono text-surface-700">
        <code>{code.trim()}</code>
      </pre>
    </div>
  )
}

// ─── Endpoint pill ────────────────────────────────────────────────────────────

function EndpointPill({
  method,
  path,
}: {
  method: 'GET' | 'POST'
  path: string
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-300 font-mono text-sm mb-4">
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded',
          method === 'GET'
            ? 'bg-emerald/20 text-emerald border border-emerald/30'
            : 'bg-for-500/20 text-for-400 border border-for-500/30'
        )}
      >
        {method}
      </span>
      <span className="text-surface-600">{path}</span>
    </div>
  )
}

// ─── Param table ──────────────────────────────────────────────────────────────

function ParamTable({
  params,
}: {
  params: { name: string; type: string; required?: boolean; description: string }[]
}) {
  return (
    <div className="rounded-xl border border-surface-300 overflow-hidden mb-6">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-surface-100 border-b border-surface-300">
            <th className="text-left px-4 py-2.5 text-surface-500 font-semibold uppercase tracking-wider text-[10px]">
              Parameter
            </th>
            <th className="text-left px-4 py-2.5 text-surface-500 font-semibold uppercase tracking-wider text-[10px]">
              Type
            </th>
            <th className="text-left px-4 py-2.5 text-surface-500 font-semibold uppercase tracking-wider text-[10px] hidden sm:table-cell">
              Required
            </th>
            <th className="text-left px-4 py-2.5 text-surface-500 font-semibold uppercase tracking-wider text-[10px]">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-300">
          {params.map((p) => (
            <tr key={p.name} className="bg-surface-50 hover:bg-surface-100 transition-colors">
              <td className="px-4 py-3 text-for-300 font-semibold">{p.name}</td>
              <td className="px-4 py-3 text-gold">{p.type}</td>
              <td className="px-4 py-3 hidden sm:table-cell">
                {p.required ? (
                  <span className="text-against-400">required</span>
                ) : (
                  <span className="text-surface-500">optional</span>
                )}
              </td>
              <td className="px-4 py-3 text-surface-600">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-10 pb-28 md:pb-14">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Code2 className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Developers
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Embed, integrate, and extend Lobby Market
              </p>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-500 max-w-2xl leading-relaxed">
            Lobby Market provides public APIs for embedding live vote widgets, subscribing to
            topic feeds, and generating branded share cards. No authentication required for
            read-only endpoints.
          </p>
        </div>

        {/* ── Quick nav ────────────────────────────────────────────────── */}
        <nav
          aria-label="API sections"
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12"
        >
          {[
            { href: '#rest-api', icon: Database, label: 'REST API', color: 'text-emerald' },
            { href: '#embed', icon: Layers, label: 'Embed Widget', color: 'text-for-400' },
            { href: '#rss', icon: Rss, label: 'RSS Feed', color: 'text-gold' },
            { href: '#ical', icon: CalendarDays, label: 'iCal Export', color: 'text-emerald' },
            { href: '#og', icon: Share2, label: 'OG Images', color: 'text-purple' },
            { href: '#badges', icon: Shield, label: 'Profile Badges', color: 'text-for-400' },
            { href: '#topic-badges', icon: FileCode2, label: 'Topic Badges', color: 'text-purple' },
            { href: '#resize', icon: Zap, label: 'Iframe Resize', color: 'text-surface-400' },
          ].map(({ href, icon: Icon, label, color }) => (
            <a
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl',
                'bg-surface-100 border border-surface-300',
                'hover:border-surface-400 hover:bg-surface-200/60',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                'font-mono text-xs text-surface-500 hover:text-white'
              )}
            >
              <Icon className={cn('h-5 w-5', color)} />
              {label}
            </a>
          ))}
        </nav>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 0: Public REST API
        ═══════════════════════════════════════════════════════════════ */}
        <section id="rest-api" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Database}
            iconColor="text-emerald"
            iconBg="bg-emerald/10 border-emerald/30"
            title="REST API v1"
            description="Query topics, laws, and platform stats programmatically — no API key needed."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            The Lobby Market public API returns JSON and supports open CORS from any origin.
            All endpoints are read-only and use the same public data visible on the site.
            Rate limits apply at the CDN layer (burst-friendly, no hard caps for reasonable use).
          </p>

          {/* Base URL callout */}
          <div className="mb-6 p-4 rounded-xl border border-emerald/30 bg-emerald/5 font-mono text-sm">
            <span className="text-surface-500 text-xs uppercase tracking-wider block mb-1">Base URL</span>
            <span className="text-emerald font-semibold">https://lobby.market/api/v1</span>
          </div>

          {/* ── GET /api/v1/topics ─────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">List topics</h3>
          <EndpointPill method="GET" path="/api/v1/topics" />
          <ParamTable
            params={[
              { name: 'status', type: 'string', required: false, description: 'Filter by lifecycle status. One of: proposed, active, voting, law, failed.' },
              { name: 'category', type: 'string', required: false, description: 'Filter by category. One of: Politics, Technology, Ethics, Culture, Economics, Science, Philosophy, Health, Environment, Education, Other.' },
              { name: 'sort', type: 'string', required: false, description: 'Sort order: votes (default), new, trending, score.' },
              { name: 'limit', type: 'integer', required: false, description: 'Number of results per page. Max 100. Default 20.' },
              { name: 'offset', type: 'integer', required: false, description: 'Pagination offset. Default 0.' },
            ]}
          />
          <CodeBlock
            lang="bash"
            label="Fetch the 20 most-voted active topics"
            code={`curl "https://lobby.market/api/v1/topics?status=active&sort=votes&limit=20"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [
    {
      "id": "uuid",
      "statement": "Universal Basic Income should be implemented",
      "description": "...",
      "category": "Economics",
      "scope": "Global",
      "status": "active",
      "for_pct": 62,
      "against_pct": 38,
      "total_votes": 14823,
      "view_count": 89210,
      "created_at": "2025-01-15T10:00:00Z",
      "voting_ends_at": null,
      "url": "https://lobby.market/topic/uuid"
    }
  ],
  "meta": {
    "total": 312,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}`}
          />

          {/* ── GET /api/v1/topics/:id ─────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Get topic by ID</h3>
          <EndpointPill method="GET" path="/api/v1/topics/{id}" />
          <ParamTable
            params={[
              { name: '{id}', type: 'UUID', required: true, description: 'The UUID of the topic.' },
            ]}
          />
          <CodeBlock
            lang="bash"
            label="Fetch a single topic with top arguments"
            code={`curl "https://lobby.market/api/v1/topics/TOPIC_UUID"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": {
    "id": "uuid",
    "statement": "...",
    "description": "...",
    "category": "Economics",
    "scope": "Global",
    "status": "active",
    "for_pct": 62,
    "against_pct": 38,
    "total_votes": 14823,
    "view_count": 89210,
    "support_count": 431,
    "activation_threshold": 500,
    "created_at": "2025-01-15T10:00:00Z",
    "voting_ends_at": null,
    "url": "https://lobby.market/topic/uuid",
    "embed_url": "https://lobby.market/api/embed/topic/uuid",
    "og_image_url": "https://lobby.market/api/og/topic/uuid",
    "top_arguments": [
      {
        "id": "uuid",
        "body": "Evidence shows that pilot programs...",
        "side": "for",
        "upvotes": 142,
        "author_username": "alice"
      }
    ]
  }
}`}
          />

          {/* ── GET /api/v1/laws ───────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">List established laws</h3>
          <EndpointPill method="GET" path="/api/v1/laws" />
          <ParamTable
            params={[
              { name: 'category', type: 'string', required: false, description: 'Filter by category (same values as /topics).' },
              { name: 'limit', type: 'integer', required: false, description: 'Max 100. Default 20.' },
              { name: 'offset', type: 'integer', required: false, description: 'Pagination offset. Default 0.' },
            ]}
          />
          <CodeBlock
            lang="bash"
            label="Fetch all laws in the Technology category"
            code={`curl "https://lobby.market/api/v1/laws?category=Technology&limit=50"`}
          />

          {/* ── GET /api/v1/stats ──────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Platform stats</h3>
          <EndpointPill method="GET" path="/api/v1/stats" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns aggregate counts for the entire platform — useful for dashboards, embeds, and status displays.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch platform stats"
            code={`curl "https://lobby.market/api/v1/stats"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": {
    "total_topics": 847,
    "total_laws": 124,
    "total_active_topics": 312,
    "total_votes": 2841920,
    "total_debates": 88,
    "total_arguments": 19203,
    "top_category": "Politics",
    "updated_at": "2025-06-13T10:00:00Z"
  }
}`}
          />

          <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">CORS:</span> All <code className="text-emerald">/api/v1/</code> endpoints set <code className="text-for-300">Access-Control-Allow-Origin: *</code>.</p>
            <p><span className="text-white">Caching:</span> Topics and laws cache for 30–60s at the CDN. Stats cache for 2 minutes.</p>
            <p><span className="text-white">Pagination:</span> Use <code className="text-for-300">limit</code> and <code className="text-for-300">offset</code> to page through results. Check <code className="text-for-300">meta.has_more</code> to detect more pages.</p>
            <p><span className="text-white">Errors:</span> Invalid parameters return HTTP 400 with an <code className="text-against-400">error</code> string and a <code className="text-surface-400">docs</code> link.</p>
          </div>

          <div className="mt-6">
            <CodeBlock
              lang="javascript"
              label="JavaScript example — fetch trending topics"
              code={`const res = await fetch(
  'https://lobby.market/api/v1/topics?sort=trending&status=active&limit=10'
);
const { data, meta } = await res.json();

for (const topic of data) {
  console.log(\`\${topic.for_pct}% FOR — \${topic.statement}\`);
}
// → 71% FOR — Universal Basic Income should be implemented
// → 58% FOR — Algorithmic content curation harms democracy`}
            />
          </div>

          {/* ── GET /api/v1/debates ──────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Debates</h3>
          <EndpointPill method="GET" path="/api/v1/debates" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns scheduled, live, and past civic debates. Filter by status or type; sort by date, upcoming schedule, or live viewer count.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch live debates"
            code={`curl "https://lobby.market/api/v1/debates?status=live&limit=5"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [{
    "id": "uuid",
    "topic_id": "uuid",
    "topic_statement": "Universal Basic Income should be implemented",
    "title": "Grand Debate: UBI",
    "description": "Opening arguments begin at 20:00 UTC",
    "type": "grand",
    "status": "live",
    "scheduled_at": "2025-06-13T20:00:00Z",
    "started_at": "2025-06-13T20:00:00Z",
    "ended_at": null,
    "viewer_count": 342,
    "blue_sway": 61,
    "red_sway": 39,
    "host_username": "civic_host",
    "host_display_name": "Civic Host",
    "created_at": "2025-06-10T12:00:00Z",
    "url": "https://lobby.market/debate/uuid"
  }],
  "meta": { "total": 12, "limit": 5, "offset": 0, "has_more": true }
}`}
          />

          {/* ── GET /api/v1/coalitions ─────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Coalitions</h3>
          <EndpointPill method="GET" path="/api/v1/coalitions" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns public civic alliances. Sort by influence score, member count, or campaign wins. Only public coalitions are returned.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch top coalitions by influence"
            code={`curl "https://lobby.market/api/v1/coalitions?sort=influence&limit=10"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [{
    "id": "uuid",
    "name": "Climate Action Coalition",
    "description": "Coordinating votes on environmental policy.",
    "member_count": 47,
    "max_members": 100,
    "coalition_influence": 2840,
    "wins": 12,
    "losses": 3,
    "win_rate": 80,
    "is_public": true,
    "creator_username": "enviro_lead",
    "creator_display_name": "Enviro Lead",
    "created_at": "2025-01-15T08:00:00Z",
    "url": "https://lobby.market/coalitions/uuid"
  }],
  "meta": { "total": 183, "limit": 10, "offset": 0, "has_more": true }
}`}
          />

          {/* ── GET /api/v1/tags ──────────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Tags</h3>
          <EndpointPill method="GET" path="/api/v1/tags" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns civic keyword tags aggregated from all topic statements. Sort by topic count, vote volume, law conversions, or active debates. Useful for building tag clouds, topic finders, and trend explorers.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch top tags by topic count"
            code={`curl "https://lobby.market/api/v1/tags?sort=topics&limit=25"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [{
    "tag": "climate",
    "topic_count": 34,
    "law_count": 8,
    "active_count": 12,
    "total_votes": 142300,
    "url": "https://lobby.market/tags/climate"
  }],
  "meta": { "total": 287, "limit": 25, "offset": 0, "has_more": true }
}`}
          />
          <p className="text-xs font-mono text-surface-600 mb-4 leading-relaxed">
            <strong className="text-surface-400">Sort options:</strong>{' '}
            <code className="text-for-300">topics</code> (default) ·{' '}
            <code className="text-for-300">votes</code> ·{' '}
            <code className="text-for-300">laws</code> ·{' '}
            <code className="text-for-300">active</code>
          </p>

          {/* ── GET /api/v1/leaderboard ───────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Leaderboard</h3>
          <EndpointPill method="GET" path="/api/v1/leaderboard" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns ranked citizens by civic engagement metrics. Each entry includes the citizen&apos;s global rank, clout score, vote count, argument count, and reputation score. Ranks reset with pagination — offset 25 starts at rank 26.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch top 25 citizens by clout"
            code={`curl "https://lobby.market/api/v1/leaderboard?metric=clout&limit=25"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [{
    "rank": 1,
    "id": "uuid",
    "username": "civic_champion",
    "display_name": "Civic Champion",
    "avatar_url": "https://...",
    "role": "elder",
    "clout": 9840,
    "total_votes": 2341,
    "total_arguments": 187,
    "reputation_score": 94.2,
    "civic_archetype": "The Legislator",
    "url": "https://lobby.market/profile/civic_champion"
  }],
  "meta": { "metric": "clout", "total": 5200, "limit": 25, "offset": 0, "has_more": true, "updated_at": "..." }
}`}
          />
          <p className="text-xs font-mono text-surface-600 mb-4 leading-relaxed">
            <strong className="text-surface-400">Metric options:</strong>{' '}
            <code className="text-for-300">clout</code> (default) ·{' '}
            <code className="text-for-300">votes</code> ·{' '}
            <code className="text-for-300">arguments</code> ·{' '}
            <code className="text-for-300">reputation</code>
          </p>

          {/* ── GET /api/v1/categories ────────────────────────────────────────── */}
          <h3 className="font-mono text-sm font-bold text-white mb-3 mt-8">Categories</h3>
          <EndpointPill method="GET" path="/api/v1/categories" />
          <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
            Returns all 10 civic debate categories with live statistics. Includes topic counts by status, total vote volume, average consensus percentage (FOR vs AGAINST), and the most-voted topic in each category. No pagination — all categories always returned.
          </p>
          <CodeBlock
            lang="bash"
            label="Fetch all categories"
            code={`curl "https://lobby.market/api/v1/categories"`}
          />
          <CodeBlock
            lang="json"
            label="Response schema"
            code={`{
  "data": [{
    "name": "Technology",
    "topic_count": 89,
    "law_count": 14,
    "active_count": 23,
    "proposed_count": 31,
    "total_votes": 487200,
    "avg_for_pct": 58.3,
    "top_topic": {
      "id": "uuid",
      "statement": "AI systems should be regulated...",
      "total_votes": 18400,
      "for_pct": 71.2,
      "status": "law",
      "url": "https://lobby.market/topic/uuid"
    },
    "url": "https://lobby.market/categories/technology"
  }],
  "meta": { "total": 10, "updated_at": "..." }
}`}
          />
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: Embed Widget
        ═══════════════════════════════════════════════════════════════ */}
        <section id="embed" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Layers}
            iconColor="text-for-400"
            iconBg="bg-for-500/10 border-for-500/30"
            title="Embed Widget"
            description="Show a live vote widget on any website with a single <iframe> tag."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            The embed widget is a fully self-contained HTML page designed to be loaded inside
            an <code className="text-for-300">&lt;iframe&gt;</code>. It displays the topic
            statement, FOR/AGAINST vote bar, and a &ldquo;Vote on Lobby Market&rdquo; call to
            action. No JavaScript required on the host page.
          </p>

          {/* Widget Builder CTA */}
          <div className="mb-6 flex items-start gap-4 p-4 rounded-xl border border-for-500/30 bg-for-500/5">
            <Layers className="h-5 w-5 text-for-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-mono font-semibold text-white mb-1">
                Try the Widget Builder
              </p>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                No need to find topic IDs manually. Use the interactive builder to search, preview, and copy your embed code.
              </p>
            </div>
            <Link
              href="/widget"
              className="flex-shrink-0 flex items-center gap-1.5 text-xs font-mono font-semibold text-for-300 hover:text-white bg-for-500/15 hover:bg-for-500/25 border border-for-500/30 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
            >
              Open Builder
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <EndpointPill method="GET" path="/api/embed/topic/{id}" />

          <ParamTable
            params={[
              {
                name: '{id}',
                type: 'UUID',
                required: true,
                description: 'The UUID of the topic to embed.',
              },
            ]}
          />

          <CodeBlock
            lang="html"
            label="Minimal embed"
            code={`<iframe
  src="https://lobby.market/api/embed/topic/TOPIC_UUID"
  width="420"
  height="230"
  frameborder="0"
  scrolling="no"
  title="Lobby Market Vote Widget"
  style="border-radius:14px;overflow:hidden;display:block"
></iframe>`}
          />

          <div className="mt-4 mb-6">
            <CodeBlock
              lang="html"
              label="Responsive embed with auto-resize"
              code={`<!-- Auto-resize using postMessage -->
<iframe
  id="lm-widget"
  src="https://lobby.market/api/embed/topic/TOPIC_UUID"
  width="420"
  height="230"
  frameborder="0"
  scrolling="no"
  title="Lobby Market Vote Widget"
  style="border-radius:14px;overflow:hidden;display:block;max-width:100%"
></iframe>

<script>
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'lobby-embed-resize') {
      var iframe = document.getElementById('lm-widget');
      if (iframe) iframe.height = e.data.height + 'px';
    }
  });
</script>`}
            />
          </div>

          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-sm font-mono text-surface-600 leading-relaxed">
            <span className="text-gold font-semibold">Tip: </span>
            Copy the embed code directly from the <strong className="text-white">Share</strong> menu
            on any topic page — click the Share button, then &ldquo;Copy embed code&rdquo;.
          </div>

          <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">Caching:</span> Widgets are cached at the CDN for 30 seconds with a 60-second stale-while-revalidate window.</p>
            <p><span className="text-white">CORS:</span> The embed endpoint allows cross-origin iframing from any host via <code className="text-for-300">Content-Security-Policy: frame-ancestors *</code>.</p>
            <p><span className="text-white">Error handling:</span> If the topic ID is not found, the widget returns a 404 with a graceful &ldquo;Topic not found&rdquo; message.</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: RSS Feed
        ═══════════════════════════════════════════════════════════════ */}
        <section id="rss" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Rss}
            iconColor="text-gold"
            iconBg="bg-gold/10 border-gold/30"
            title="RSS Feed"
            description="Subscribe to new laws and active debates in your favourite RSS reader."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            The Lobby Market RSS feed publishes all newly established laws and highly-active
            topics. It follows the RSS 2.0 standard and is compatible with any feed reader.
          </p>

          <div className="space-y-3 mb-6">
            <EndpointPill method="GET" path="/api/rss" />
            <EndpointPill method="GET" path="/api/rss/laws" />
            <EndpointPill method="GET" path="/api/rss/debates" />
            <EndpointPill method="GET" path="/api/rss/category/{slug}" />
            <EndpointPill method="GET" path="/api/rss/tag/{tag}" />
          </div>

          <CodeBlock
            lang="bash"
            label="Available feeds"
            code={`# Combined feed (laws + active topics)
https://lobby.market/api/rss

# Laws only
https://lobby.market/api/rss/laws

# Live & upcoming debates
https://lobby.market/api/rss/debates

# Category feeds (replace {slug} with lowercase category)
# Valid slugs: economics, politics, technology, science,
#              ethics, philosophy, culture, health, environment, education
https://lobby.market/api/rss/category/{slug}

# Tag feeds — follow any civic keyword tag
# Examples: climate, ai, democracy, tax, immigration, healthcare,
#           housing, energy, privacy, guns, labor, free-speech
https://lobby.market/api/rss/tag/{tag}`}
          />

          <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">Format:</span> RSS 2.0 with full item descriptions and category tags.</p>
            <p><span className="text-white">Update frequency:</span> All feeds cache for 5 minutes at the CDN.</p>
            <p><span className="text-white">Items included:</span> Established laws and active/voting/proposed topics tagged with the keyword.</p>
            <p><span className="text-white">Tag feeds:</span> Returns 404 if no topics match the tag — useful for existence-checking integrations.</p>
          </div>

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <Link
              href="/api/rss"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono',
                'bg-gold/10 border border-gold/30 text-gold',
                'hover:bg-gold/20 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50'
              )}
            >
              <Rss className="h-4 w-4" />
              Open Main Feed
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
            <Link
              href="/feeds"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:text-white hover:border-surface-400 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-500'
              )}
            >
              Browse all feeds →
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: iCal Export
        ═══════════════════════════════════════════════════════════════ */}
        <section id="ical" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={CalendarDays}
            iconColor="text-emerald"
            iconBg="bg-emerald/10 border-emerald/30"
            title="iCal Export"
            description="Add upcoming debates to Google Calendar, Apple Calendar, or Outlook."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            Download a single debate as an <code className="text-emerald">.ics</code> file or subscribe
            to the full upcoming debate feed. The feed is compatible with any calendar application
            that supports the iCalendar (RFC 5545) standard.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <p className="text-xs font-mono text-surface-600 mb-2">Single debate</p>
              <EndpointPill method="GET" path="/api/debates/{id}/ics" />
            </div>
            <div>
              <p className="text-xs font-mono text-surface-600 mb-2">All upcoming debates (next 60 days)</p>
              <EndpointPill method="GET" path="/api/debates/upcoming.ics" />
            </div>
          </div>

          <CodeBlock
            lang="bash"
            label="Example — download all upcoming debates"
            code={`curl -O https://lobby.market/api/debates/upcoming.ics\n# Then import into Google Calendar → Other calendars → Import`}
          />

          <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">Format:</span> iCalendar RFC 5545 — VCALENDAR + VEVENT blocks.</p>
            <p><span className="text-white">Single debate:</span> Returns 410 Gone if the debate has already ended.</p>
            <p><span className="text-white">Feed cache:</span> 30-minute CDN cache. Refresh to pick up newly scheduled debates.</p>
            <p><span className="text-white">Duration:</span> 15 min for Quick, 45 min for Grand, 60 min for Tribunal debates.</p>
          </div>

          <div className="mt-4">
            <a
              href="/api/debates/upcoming.ics"
              download="lobby-market-debates.ics"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono',
                'bg-emerald/10 border border-emerald/30 text-emerald',
                'hover:bg-emerald/20 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald/50'
              )}
            >
              <CalendarDays className="h-4 w-4" />
              Download Upcoming Debates (.ics)
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: OG Images
        ═══════════════════════════════════════════════════════════════ */}
        <section id="og" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Share2}
            iconColor="text-purple"
            iconBg="bg-purple/10 border-purple/30"
            title="Open Graph Images"
            description="Dynamic 1200×630 social share cards generated server-side for every piece of content."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            Every topic, law, profile, achievement, coalition, and debate has a unique OG
            image. These images are automatically embedded in the <code className="text-for-300">&lt;meta&gt;</code> tags
            of the relevant page, so sharing a Lobby Market URL on Twitter, Discord, Slack,
            or any other platform automatically shows a rich preview card.
          </p>

          <div className="space-y-3 mb-6">
            {[
              {
                label: 'Topic card',
                path: '/api/og/topic/{id}',
                description: 'Vote bar, status badge, FOR/AGAINST percentages.',
              },
              {
                label: 'Law card',
                path: '/api/og/law/{id}',
                description: 'Gold seal, final vote result, establishment date.',
              },
              {
                label: 'Profile card',
                path: '/api/og/profile/{username}',
                description: 'Avatar, role, vote stats, top categories.',
              },
              {
                label: 'Achievement card',
                path: '/api/og/achievement/{id}',
                description: 'Achievement icon, tier badge, unlock criteria.',
              },
              {
                label: 'Coalition card',
                path: '/api/og/coalition/{id}',
                description: 'Coalition name, member count, top stances.',
              },
              {
                label: 'Stance card',
                path: '/api/og/stance',
                description: 'Personalised "I voted FOR/AGAINST" share card.',
              },
            ].map(({ label, path, description }) => (
              <div
                key={path}
                className="flex items-start gap-4 p-4 rounded-xl bg-surface-100 border border-surface-300"
              >
                <FileCode2 className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-white">
                      {label}
                    </span>
                    <code className="text-[11px] font-mono text-for-300 bg-surface-200 px-1.5 py-0.5 rounded">
                      GET {path}
                    </code>
                  </div>
                  <p className="text-xs font-mono text-surface-500 mt-1">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm font-mono text-surface-500 mb-4 leading-relaxed">
            You can also use stance OG images as standalone share cards. The stance endpoint
            accepts query parameters:
          </p>

          <ParamTable
            params={[
              {
                name: 'statement',
                type: 'string',
                required: true,
                description: 'The topic statement text.',
              },
              {
                name: 'side',
                type: '"for" | "against"',
                required: true,
                description: "The user's vote side.",
              },
              {
                name: 'pct',
                type: 'integer',
                required: false,
                description: 'Current FOR percentage (0–100). Defaults to 50.',
              },
              {
                name: 'votes',
                type: 'integer',
                required: false,
                description: 'Total votes cast.',
              },
              {
                name: 'category',
                type: 'string',
                required: false,
                description: 'Topic category label.',
              },
            ]}
          />

          <CodeBlock
            lang="text"
            label="Stance card URL example"
            code={`https://lobby.market/api/og/stance?statement=Universal+Basic+Income+should+be+adopted&side=for&pct=58&votes=2341`}
          />

          <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">Format:</span> PNG, 1200×630 px. Generated by <code className="text-for-300">next/og</code> (Vercel Edge-compatible).</p>
            <p><span className="text-white">Caching:</span> OG images are cached for 5 minutes at the CDN.</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5: Profile Badges
        ═══════════════════════════════════════════════════════════════ */}
        <section id="badges" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Shield}
            iconColor="text-for-400"
            iconBg="bg-for-500/10 border-for-500/30"
            title="Profile Badges"
            description="SVG badges that embed a user's live civic stats on GitHub READMEs, portfolios, and personal sites."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            Every Lobby Market user gets a shareable SVG badge. It updates automatically
            — no webhooks, no tokens. Cached for 5 minutes on the CDN.
          </p>

          <div className="mb-6 p-4 rounded-xl bg-surface-100 border border-surface-300">
            <p className="text-xs font-mono text-surface-500 mb-3">Badge endpoint</p>
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald/10 text-emerald border border-emerald/30 text-xs font-bold">GET</span>
              <code className="text-for-300">/api/badges/profile/<span className="text-gold">{'{username}'}</span></code>
            </div>
            <p className="text-xs font-mono text-surface-600 mt-2">Returns <code className="text-for-300">image/svg+xml</code> · Cache-Control: 5 min · No auth required</p>
          </div>

          <div className="mb-6 space-y-3">
            <p className="text-xs font-mono text-white font-semibold">GitHub README example:</p>
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 font-mono text-xs text-surface-500 leading-relaxed">
              <span className="text-surface-600">{'# My Projects'}</span>
              {'\n\n'}
              <span className="text-for-300">{'[![Lobby Market Badge](https://lobby.market/api/badges/profile/YOUR_USERNAME)](https://lobby.market/profile/YOUR_USERNAME)'}</span>
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-xs font-mono text-white font-semibold">Stats shown on the badge:</p>
            {[
              { name: 'Clout', desc: 'Total civic currency earned' },
              { name: 'Votes', desc: 'Topics you\'ve voted on' },
              { name: 'Rep', desc: 'Reputation score from arguments & debates' },
              { name: 'Streak', desc: 'Current consecutive daily voting streak' },
            ].map(({ name, desc }) => (
              <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300">
                <span className="text-xs font-mono font-bold text-for-400 w-12 flex-shrink-0">{name}</span>
                <span className="text-xs font-mono text-surface-500">{desc}</span>
              </div>
            ))}
          </div>

          <Link
            href="/badges"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold',
              'bg-for-600/90 text-white border border-for-500/40',
              'hover:bg-for-500 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50'
            )}
          >
            <Shield className="h-4 w-4" />
            Open Badge Builder
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5b: Topic Badges
        ═══════════════════════════════════════════════════════════════ */}
        <section id="topic-badges" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={FileCode2}
            iconColor="text-purple"
            iconBg="bg-purple/10 border-purple/30"
            title="Topic Badges"
            description="Embeddable SVG badges for any debate — live vote split, status, and category. Perfect for blogs, READMEs, and forums."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            Topic badges are self-updating SVG images showing the current FOR/AGAINST split,
            topic status, vote count, and category. No auth required. Cached for 1 minute.
            Copy the badge code from the Share menu on any topic page.
          </p>

          <div className="mb-6 p-4 rounded-xl bg-surface-100 border border-surface-300">
            <p className="text-xs font-mono text-surface-500 mb-3">Badge endpoint</p>
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="px-2 py-0.5 rounded-md bg-emerald/10 text-emerald border border-emerald/30 text-xs font-bold">GET</span>
              <code className="text-for-300">/api/badges/topic/<span className="text-gold">{'{id}'}</span></code>
            </div>
            <p className="text-xs font-mono text-surface-600 mt-2">
              Returns <code className="text-for-300">image/svg+xml</code> · Cache-Control: 1 min · No auth required · CORS: *
            </p>
          </div>

          <div className="mb-6 space-y-3">
            <p className="text-xs font-mono text-white font-semibold">HTML embed:</p>
            <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 font-mono text-xs text-surface-500 leading-relaxed whitespace-pre">
              <span className="text-surface-600">{'<!-- Link the badge to the topic page -->'}</span>
              {'\n'}
              <span className="text-purple">{'<a'}</span>
              <span className="text-gold">{' href'}</span>
              <span className="text-for-300">{'="https://lobby.market/topic/TOPIC_UUID"'}</span>
              <span className="text-purple">{'>'}</span>
              {'\n  '}
              <span className="text-purple">{'<img'}</span>
              <span className="text-gold">{' src'}</span>
              <span className="text-for-300">{'="https://lobby.market/api/badges/topic/TOPIC_UUID"'}</span>
              {'\n       '}
              <span className="text-gold">{'alt'}</span>
              <span className="text-for-300">{'="Lobby Market debate badge"'}</span>
              <span className="text-gold">{' width'}</span>
              <span className="text-for-300">{'="440"'}</span>
              <span className="text-gold">{' height'}</span>
              <span className="text-for-300">{'="120"'}</span>
              <span className="text-purple">{' />'}</span>
              {'\n'}
              <span className="text-purple">{'</a>'}</span>
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <p className="text-xs font-mono text-white font-semibold">Stats shown on the topic badge:</p>
            {[
              { name: 'Status', desc: 'PROPOSED / ACTIVE / VOTING / LAW / FAILED' },
              { name: 'Category', desc: 'Topic category with matching accent colour' },
              { name: 'Statement', desc: 'Topic statement (first 72 characters)' },
              { name: 'Vote bar', desc: 'Blue FOR / Red AGAINST proportional split bar' },
              { name: 'Vote %', desc: 'FOR % and AGAINST % labels' },
              { name: 'Vote count', desc: 'Total votes cast, formatted (12.4K, 1.1M, etc.)' },
            ].map(({ name, desc }) => (
              <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300">
                <span className="text-xs font-mono font-bold text-purple w-20 flex-shrink-0">{name}</span>
                <span className="text-xs font-mono text-surface-500">{desc}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-mono text-surface-600 leading-relaxed">
            <span className="text-white">Tip:</span> Use the Share button on any topic page and click{' '}
            <span className="text-purple font-semibold">&ldquo;Copy SVG badge&rdquo;</span> to get the
            ready-to-paste HTML code for that specific topic.
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 6: iframe Resize Protocol
        ═══════════════════════════════════════════════════════════════ */}
        <section id="resize" className="mb-16 scroll-mt-20">
          <SectionHeader
            icon={Zap}
            iconColor="text-emerald"
            iconBg="bg-emerald/10 border-emerald/30"
            title="iframe Auto-Resize"
            description="The embed widget posts its rendered height to the parent page so you can size the iframe perfectly."
          />

          <p className="text-sm font-mono text-surface-500 mb-6 leading-relaxed">
            After rendering, the embed widget sends a{' '}
            <code className="text-for-300">window.postMessage</code> to the parent page with
            the widget height. Listen for this message to resize the iframe and avoid empty
            space or scrollbars.
          </p>

          <div className="mb-4 p-4 rounded-xl bg-surface-100 border border-surface-300 font-mono text-xs text-surface-500 space-y-2">
            <p className="text-white text-sm">Message shape:</p>
            <CodeBlock
              lang="json"
              label="postMessage payload"
              code={`{
  "type": "lobby-embed-resize",
  "height": 238  // rendered height in px (number)
}`}
            />
          </div>

          <CodeBlock
            lang="javascript"
            label="Auto-resize listener"
            code={`// Add this once to your page to handle all Lobby Market widgets.
window.addEventListener('message', function (e) {
  // Only handle trusted Lobby Market messages.
  if (!e.data || e.data.type !== 'lobby-embed-resize') return;

  // Match iframes by src origin.
  var iframes = document.querySelectorAll(
    'iframe[src*="lobby.market/api/embed/"]'
  );
  iframes.forEach(function (iframe) {
    if (iframe.contentWindow === e.source) {
      iframe.height = e.data.height + 'px';
    }
  });
});`}
          />

          <p className="text-sm font-mono text-surface-500 mt-4">
            The message is sent once on load. If you need to handle dynamic height changes,
            wrap the listener in a <code className="text-for-300">ResizeObserver</code> inside
            the widget (not currently supported — open an issue if you need it).
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            Footer nav
        ═══════════════════════════════════════════════════════════════ */}
        <div className="border-t border-surface-300 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="font-mono text-xs text-surface-500">
            <p>Questions? Open an issue on{' '}
              <a
                href="https://github.com/LoryApps/lobby_market"
                target="_blank"
                rel="noopener noreferrer"
                className="text-for-400 hover:text-for-300 transition-colors"
              >
                GitHub
              </a>{' '}
              or start a debate on the platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/status"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Platform Status
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              About
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/"
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-for-600 text-white hover:bg-for-500 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Enter the Lobby
            </Link>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
