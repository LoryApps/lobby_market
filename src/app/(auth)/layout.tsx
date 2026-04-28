import type { ReactNode } from 'react'
import Link from 'next/link'
import { Scale, TrendingUp, Zap } from 'lucide-react'

const FEATURES = [
  {
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    title: 'Live consensus engine',
    body: 'Every vote shifts the market in real time.',
  },
  {
    icon: Scale,
    color: 'text-gold',
    bg: 'bg-gold/10',
    title: 'Ideas become law',
    body: 'Reach 70% consensus and your position is codified.',
  },
  {
    icon: Zap,
    color: 'text-purple',
    bg: 'bg-purple/10',
    title: 'Earn clout & achievements',
    body: 'Build reputation by being on the right side of history.',
  },
] as const

const AVATARS = ['L', 'M', 'A', 'T', 'J'] as const

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-surface-50 flex flex-col lg:flex-row overflow-hidden">

      {/* ── Ambient background glows ──────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      >
        <div
          className="absolute -top-60 -right-60 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-60 -left-60 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Left panel: branding + features (lg+) ────────────────────── */}
      <aside className="hidden lg:flex flex-col justify-center px-14 py-16 w-[44%] flex-shrink-0 relative z-10">

        {/* Wordmark */}
        <Link href="/" className="inline-flex flex-col mb-14 group w-fit">
          <span className="font-mono text-5xl font-bold text-white tracking-widest uppercase leading-none">
            LOBBY
          </span>
          <div className="flex h-[3px] w-full mt-1.5">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
          <span className="font-mono text-[11px] text-surface-500 tracking-[0.3em] mt-2 uppercase">
            Market
          </span>
        </Link>

        <h2 className="text-3xl font-bold text-white leading-snug mb-3">
          The People&apos;s<br />Consensus Engine
        </h2>
        <p className="text-surface-500 text-[15px] leading-relaxed mb-10 max-w-xs">
          Vote on policy, debate in real-time, and turn community consensus into
          codified law.
        </p>

        {/* Feature list */}
        <ul className="space-y-5">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <li key={f.title} className="flex items-start gap-4">
                <div
                  className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${f.bg}`}
                >
                  <Icon className={`h-[18px] w-[18px] ${f.color}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-surface-500">{f.body}</p>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Social proof */}
        <div className="mt-12 flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden="true">
            {AVATARS.map((initial, i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full bg-surface-300 border-2 border-surface-50 flex items-center justify-center text-xs font-mono font-bold text-surface-600 select-none"
              >
                {initial}
              </div>
            ))}
          </div>
          <p className="text-sm text-surface-500">
            Join thousands shaping tomorrow&apos;s laws.
          </p>
        </div>

        <p className="mt-auto pt-16 text-[11px] font-mono text-surface-400/60 tracking-wider uppercase">
          Lobby Market · Beta
        </p>
      </aside>

      {/* ── Right panel: form ─────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center relative z-10 px-4 py-14 lg:px-12 lg:py-10">
        <div className="w-full max-w-md">

          {/* Mobile-only wordmark */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Link href="/" className="inline-flex flex-col items-center">
              <span className="font-mono text-4xl font-bold text-white tracking-widest uppercase leading-none">
                LOBBY
              </span>
              <div className="flex h-[3px] w-full mt-1.5">
                <div className="flex-1 bg-for-500 rounded-l-full" />
                <div className="flex-1 bg-against-500 rounded-r-full" />
              </div>
              <span className="font-mono text-[10px] text-surface-500 tracking-[0.3em] mt-1.5 uppercase">
                Market
              </span>
            </Link>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
