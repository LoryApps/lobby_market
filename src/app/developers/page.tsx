import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Code2,
  ExternalLink,
  FileCode2,
  Globe,
  Layers,
  Rss,
  Share2,
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
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12"
        >
          {[
            { href: '#embed', icon: Layers, label: 'Embed Widget', color: 'text-for-400' },
            { href: '#rss', icon: Rss, label: 'RSS Feed', color: 'text-gold' },
            { href: '#og', icon: Share2, label: 'OG Images', color: 'text-purple' },
            { href: '#resize', icon: Zap, label: 'Iframe Resize', color: 'text-emerald' },
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

          <EndpointPill method="GET" path="/api/rss" />

          <CodeBlock
            lang="xml"
            label="Feed URL"
            code="https://lobby.market/api/rss"
          />

          <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 p-4 font-mono text-xs text-surface-500 space-y-1">
            <p><span className="text-white">Format:</span> RSS 2.0 with full item descriptions and category tags.</p>
            <p><span className="text-white">Update frequency:</span> Revalidated every 5 minutes at the CDN.</p>
            <p><span className="text-white">Items included:</span> Established laws + active/voting topics ordered by establishment date.</p>
          </div>

          <div className="mt-4 flex items-center gap-3">
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
              Open RSS Feed
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: OG Images
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
            SECTION 4: iframe Resize Protocol
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
