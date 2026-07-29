import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Shared primitives ────────────────────────────────────────────────────────

function ExchangeTopBar() {
  return (
    <div className="h-14 border-b border-surface-300 bg-surface-100 flex items-center px-4 justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  )
}

function ExchangeBottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface-100 border-t border-surface-300 flex items-center justify-around px-2 md:hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-2 w-8" />
        </div>
      ))}
    </div>
  )
}

function TabRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-xl p-1 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 flex-1 rounded-lg" />
      ))}
    </div>
  )
}

/** Standard Exchange market list card */
function MarketCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      {/* Statement */}
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className={cn('h-4', wide ? 'w-4/5' : 'w-2/3')} />
      </div>
      {/* Price bar + stats */}
      <div className="space-y-1.5">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10 ml-auto" />
        </div>
      </div>
    </div>
  )
}

/** Market card with a momentum/delta bar */
function MomentumCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Momentum bar */}
      <div className="space-y-1">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  )
}

/** Category bar skeleton (for pulse / volatility by-category) */
function CategoryBarSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300 last:border-0">
      <Skeleton className="h-4 w-20 flex-shrink-0" />
      <Skeleton className="h-2 flex-1 rounded-full" />
      <Skeleton className="h-4 w-8 flex-shrink-0" />
    </div>
  )
}

/** Alert row skeleton */
function AlertRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
    </div>
  )
}

// ─── Page-level skeletons ─────────────────────────────────────────────────────

/** Movers page — 4 tabs, gainers/losers/volatile/volume cards */
export function MoversPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        <TabRow count={4} />
        {Array.from({ length: 5 }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Momentum page — 4 tabs, surging/falling/breakouts/stalling */
export function MomentumPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Description card */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
        <TabRow count={4} />
        {Array.from({ length: 5 }).map((_, i) => (
          <MomentumCardSkeleton key={i} />
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Volatility page — fear gauge + 3 tabs */
export function VolatilityPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Fear gauge card */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        {/* Timeframe + tabs */}
        <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 flex-1 rounded-md" />
          ))}
        </div>
        <TabRow count={3} />
        {Array.from({ length: 5 }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Pulse page — sentiment bar + category vitals + threshold markets */
export function PulsePageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Sentiment overview */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        {/* Category vitals */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-32 mb-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <CategoryBarSkeleton key={i} />
          ))}
        </div>
        {/* Near-threshold markets */}
        <Skeleton className="h-4 w-36 mb-1" />
        {Array.from({ length: 4 }).map((_, i) => (
          <MarketCardSkeleton key={i} />
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Daily brief page — sections with cards */
export function DailyPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-6">
        {/* Date header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-6 w-10 mx-auto" />
            </div>
          ))}
        </div>
        {/* Section cards */}
        {[0, 1].map((s) => (
          <div key={s} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Alerts page — list of price alert rows */
export function AlertsPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-3">
        {/* Create alert CTA */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-24 mt-2" />
        {Array.from({ length: 6 }).map((_, i) => (
          <AlertRowSkeleton key={i} />
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Crossings page — laws that just crossed thresholds */
export function CrossingsPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Timeframe strip */}
        <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 w-fit">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
        </div>
        {/* Crossing type tabs */}
        <TabRow count={3} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full flex-shrink-0" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Risk page — risk metrics cards */
export function RiskPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Risk overview gauge */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg bg-surface-200 p-3 space-y-2">
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-6 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        {/* Risk factor list */}
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-12 rounded-full flex-shrink-0" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}

/** Trends page — market trend lines */
export function TrendsPageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <ExchangeTopBar />
      <main className="max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
        {/* Period selector */}
        <div className="flex gap-1 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 w-fit">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-12 rounded-md" />
          ))}
        </div>
        {/* Trend categories */}
        <TabRow count={3} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            {/* Sparkline placeholder */}
            <Skeleton className="h-10 w-full rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10 ml-auto" />
            </div>
          </div>
        ))}
      </main>
      <ExchangeBottomNav />
    </div>
  )
}
