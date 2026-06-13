'use client'

/**
 * /api-explorer — Interactive Lobby Market v1 API Explorer
 *
 * Lets developers (and curious citizens) browse, configure, and live-test
 * every v1 REST endpoint in the browser. Shows the raw JSON response,
 * HTTP status, latency, and a copy-able cURL command.
 *
 * Endpoints:
 *   GET /api/v1/stats
 *   GET /api/v1/topics
 *   GET /api/v1/topics/:id
 *   GET /api/v1/laws
 *   GET /api/v1/arguments
 *   GET /api/v1/users
 *   GET /api/v1/users/:username
 *   GET /api/v1/debates
 *   GET /api/v1/coalitions
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  MessageSquare,
  Mic,
  Play,
  RotateCcw,
  Scale,
  Shield,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Endpoint definitions ─────────────────────────────────────────────────────

interface ParamSpec {
  name: string
  type: 'string' | 'number' | 'select'
  label: string
  options?: string[]
  placeholder?: string
  default?: string
}

interface Endpoint {
  id: string
  label: string
  method: 'GET'
  path: string
  description: string
  icon: typeof Activity
  color: string
  bg: string
  border: string
  params: ParamSpec[]
}

const ENDPOINTS: Endpoint[] = [
  {
    id: 'stats',
    label: 'Platform Stats',
    method: 'GET',
    path: '/api/v1/stats',
    description: 'Aggregate platform statistics: total topics, laws, votes, debates, and arguments.',
    icon: Activity,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    params: [],
  },
  {
    id: 'topics',
    label: 'List Topics',
    method: 'GET',
    path: '/api/v1/topics',
    description: 'Paginated list of civic debate topics with filters for status and category.',
    icon: Scale,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'status',
        type: 'select',
        label: 'Status',
        options: ['', 'proposed', 'active', 'voting', 'law', 'failed'],
        default: '',
      },
      {
        name: 'category',
        type: 'select',
        label: 'Category',
        options: [
          '', 'Politics', 'Technology', 'Ethics', 'Culture', 'Economics',
          'Science', 'Philosophy', 'Health', 'Environment', 'Education', 'Other',
        ],
        default: '',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['votes', 'new', 'trending'],
        default: 'votes',
      },
    ],
  },
  {
    id: 'topic-by-id',
    label: 'Get Topic',
    method: 'GET',
    path: '/api/v1/topics/:id',
    description: 'Full details for a single topic including vote distribution and status.',
    icon: Scale,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    params: [
      {
        name: 'id',
        type: 'string',
        label: 'Topic ID',
        placeholder: 'uuid',
        default: '',
      },
    ],
  },
  {
    id: 'laws',
    label: 'List Laws',
    method: 'GET',
    path: '/api/v1/laws',
    description: 'Established consensus laws from the Lobby Market Codex.',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'category',
        type: 'select',
        label: 'Category',
        options: [
          '', 'Politics', 'Technology', 'Ethics', 'Culture', 'Economics',
          'Science', 'Philosophy', 'Health', 'Environment', 'Education', 'Other',
        ],
        default: '',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['recent', 'votes', 'alphabetical'],
        default: 'recent',
      },
    ],
  },
  {
    id: 'arguments',
    label: 'List Arguments',
    method: 'GET',
    path: '/api/v1/arguments',
    description: 'Top civic arguments with AI quality scores, sorted by upvotes or AI grade.',
    icon: MessageSquare,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'topic_id',
        type: 'string',
        label: 'Topic ID (optional)',
        placeholder: 'uuid',
        default: '',
      },
      {
        name: 'side',
        type: 'select',
        label: 'Side',
        options: ['', 'for', 'against'],
        default: '',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['upvotes', 'score', 'new'],
        default: 'upvotes',
      },
    ],
  },
  {
    id: 'users',
    label: 'List Users',
    method: 'GET',
    path: '/api/v1/users',
    description: 'Public citizen profiles ranked by civic influence.',
    icon: Users,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['clout', 'votes', 'arguments', 'new'],
        default: 'clout',
      },
    ],
  },
  {
    id: 'user-by-username',
    label: 'Get User',
    method: 'GET',
    path: '/api/v1/users/:username',
    description: 'Public profile for a single citizen by their username.',
    icon: Users,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    params: [
      {
        name: 'username',
        type: 'string',
        label: 'Username',
        placeholder: 'civic_citizen',
        default: '',
      },
    ],
  },
  {
    id: 'debates',
    label: 'List Debates',
    method: 'GET',
    path: '/api/v1/debates',
    description: 'Scheduled, live, and past civic debates with host info and audience sway metrics.',
    icon: Mic,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'status',
        type: 'select',
        label: 'Status',
        options: ['', 'scheduled', 'live', 'ended', 'cancelled'],
        default: '',
      },
      {
        name: 'type',
        type: 'select',
        label: 'Type',
        options: ['', 'quick', 'grand', 'tribunal'],
        default: '',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['newest', 'scheduled', 'viewers'],
        default: 'newest',
      },
    ],
  },
  {
    id: 'coalitions',
    label: 'List Coalitions',
    method: 'GET',
    path: '/api/v1/coalitions',
    description: 'Public civic alliances ranked by influence, member count, or campaign wins.',
    icon: Shield,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    params: [
      {
        name: 'limit',
        type: 'select',
        label: 'Limit',
        options: ['5', '10', '20', '50'],
        default: '10',
      },
      {
        name: 'offset',
        type: 'number',
        label: 'Offset',
        placeholder: '0',
        default: '0',
      },
      {
        name: 'sort',
        type: 'select',
        label: 'Sort',
        options: ['influence', 'members', 'wins', 'new'],
        default: 'influence',
      },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(endpoint: Endpoint, paramValues: Record<string, string>): string {
  let path = endpoint.path

  // Replace path params (e.g., :id, :username)
  for (const param of endpoint.params) {
    const val = paramValues[param.name]?.trim() ?? ''
    if (path.includes(`:${param.name}`)) {
      if (!val) return ''
      path = path.replace(`:${param.name}`, encodeURIComponent(val))
    }
  }

  // Build query string
  const qs = new URLSearchParams()
  for (const param of endpoint.params) {
    if (path.includes(`:${param.name}`)) continue
    const val = paramValues[param.name]?.trim() ?? param.default ?? ''
    if (val) qs.set(param.name, val)
  }

  const query = qs.toString()
  return query ? `${path}?${query}` : path
}

function buildCurl(endpoint: Endpoint, paramValues: Record<string, string>): string {
  const url = buildUrl(endpoint, paramValues)
  if (!url) return ''
  return `curl -s "https://lobby.market${url}"`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec
  value: string
  onChange: (v: string) => void
}) {
  const base = cn(
    'w-full px-3 py-2 rounded-lg font-mono text-xs',
    'bg-surface-200 border border-surface-300 text-white',
    'placeholder:text-surface-500',
    'focus:outline-none focus:border-surface-400',
  )

  if (spec.type === 'select') {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
          {spec.label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(base, 'cursor-pointer')}
        >
          {spec.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt || '— any —'}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
        {spec.label}
      </label>
      <input
        type={spec.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={spec.placeholder}
        className={base}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RunResult {
  status: number
  latencyMs: number
  body: unknown
}

export function ApiExplorerClient() {
  const [activeId, setActiveId] = useState<string>('stats')
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({})
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)

  const activeEndpoint = ENDPOINTS.find((e) => e.id === activeId)!
  const currentParams = paramValues[activeId] ?? {}

  function getParamValue(name: string) {
    return currentParams[name] ?? activeEndpoint.params.find((p) => p.name === name)?.default ?? ''
  }

  function setParam(name: string, value: string) {
    setParamValues((prev) => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? {}), [name]: value },
    }))
  }

  const url = buildUrl(activeEndpoint, currentParams)
  const curlCmd = buildCurl(activeEndpoint, currentParams)

  const runRequest = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const res = await fetch(url)
      const latencyMs = Date.now() - start
      let body: unknown
      try {
        body = await res.json()
      } catch {
        body = await res.text()
      }
      setResult({ status: res.status, latencyMs, body })
    } catch (err) {
      setResult({
        status: 0,
        latencyMs: Date.now() - start,
        body: { error: err instanceof Error ? err.message : 'Network error' },
      })
    } finally {
      setLoading(false)
    }
  }, [url])

  async function copyToClipboard(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 1800)
    } catch {
      // fallback silently
    }
  }

  const statusColor =
    result === null
      ? 'text-surface-500'
      : result.status >= 200 && result.status < 300
        ? 'text-emerald'
        : result.status >= 400
          ? 'text-against-400'
          : 'text-gold'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-6 pb-24">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Developers
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
                <Code2 className="h-5 w-5 text-for-400" />
                API Explorer
              </h1>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Lobby Market v1 REST API — test any endpoint live in your browser
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                v1
              </Badge>
              <Link
                href="/developers"
                className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Docs
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Base URL pill */}
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300">
          <Zap className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
          <span className="text-[11px] font-mono text-surface-600 select-all">
            https://lobby.market/api/v1
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Endpoint list */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-3">
              Endpoints
            </p>
            {ENDPOINTS.map((ep) => {
              const Icon = ep.icon
              const isActive = activeId === ep.id
              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setActiveId(ep.id)
                    setResult(null)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                    'border font-mono',
                    isActive
                      ? cn('bg-surface-100', ep.border, 'text-white')
                      : 'bg-surface-100/50 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                  )}
                >
                  <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg', isActive ? ep.bg : 'bg-surface-200')}>
                    <Icon className={cn('h-4 w-4', isActive ? ep.color : 'text-surface-500')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider', isActive ? 'text-emerald' : 'text-surface-600')}>
                        GET
                      </span>
                      <span className="text-xs truncate">{ep.label}</span>
                    </div>
                    <p className="text-[10px] text-surface-600 font-mono truncate mt-0.5">{ep.path}</p>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Right: Request builder + response */}
          <div className="lg:col-span-2 space-y-4">

            {/* Endpoint card */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0', activeEndpoint.bg)}>
                  <activeEndpoint.icon className={cn('h-5 w-5', activeEndpoint.color)} />
                </div>
                <div>
                  <h2 className="text-sm font-mono font-semibold text-white">{activeEndpoint.label}</h2>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">{activeEndpoint.description}</p>
                </div>
              </div>

              {/* URL preview */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200 border border-surface-300 mb-4">
                <span className="text-[10px] font-bold font-mono text-emerald uppercase tracking-wider flex-shrink-0">GET</span>
                <span className="text-[11px] font-mono text-surface-600 truncate select-all">
                  https://lobby.market{url || activeEndpoint.path}
                </span>
              </div>

              {/* Params */}
              {activeEndpoint.params.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {activeEndpoint.params.map((spec) => (
                    <ParamField
                      key={spec.name}
                      spec={spec}
                      value={getParamValue(spec.name)}
                      onChange={(v) => setParam(spec.name, v)}
                    />
                  ))}
                </div>
              )}

              {/* Run button */}
              <div className="flex items-center gap-2">
                <Button
                  variant="for"
                  size="sm"
                  onClick={runRequest}
                  disabled={loading || !url}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Running…
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Run Request
                    </>
                  )}
                </Button>
                {result && (
                  <button
                    onClick={() => setResult(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* cURL snippet */}
            {curlCmd && (
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                    cURL
                  </span>
                  <button
                    onClick={() => copyToClipboard(curlCmd, setCopiedCurl)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
                  >
                    {copiedCurl ? (
                      <>
                        <Check className="h-3 w-3 text-emerald" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-surface-600 overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {curlCmd}
                </pre>
              </div>
            )}

            {/* Response */}
            <AnimatePresence>
              {(loading || result) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
                >
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                        Response
                      </span>
                      {result && (
                        <>
                          <span className={cn('text-xs font-mono font-bold', statusColor)}>
                            {result.status || 'ERR'}
                          </span>
                          <span className="text-[10px] font-mono text-surface-600">
                            {result.latencyMs}ms
                          </span>
                        </>
                      )}
                    </div>
                    {result && (
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(result.body, null, 2), setCopiedResponse)
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
                      >
                        {copiedResponse ? (
                          <>
                            <Check className="h-3 w-3 text-emerald" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy JSON
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 max-h-[480px] overflow-auto">
                    {loading ? (
                      <div className="flex items-center gap-2 text-surface-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs font-mono">Fetching…</span>
                      </div>
                    ) : result ? (
                      <pre className="text-[11px] font-mono text-surface-600 whitespace-pre-wrap break-all leading-relaxed">
                        {JSON.stringify(result.body, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No result placeholder */}
            {!loading && !result && (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-surface-300 rounded-2xl">
                <Code2 className="h-8 w-8 text-surface-400 mb-3" />
                <p className="text-sm font-mono text-surface-500">
                  Configure your request and click Run
                </p>
                <p className="text-xs font-mono text-surface-600 mt-1">
                  The live JSON response will appear here
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
