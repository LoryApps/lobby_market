import React from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-surface-300/50 ${className ?? ''}`} style={style} />
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Sk className="h-7 w-7 rounded-lg flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Sk className="h-4 w-16 rounded-full" />
            <Sk className="h-4 w-12 rounded-full" />
          </div>
          <Sk className="h-5 w-full" />
          <Sk className="h-5 w-4/5" />
        </div>
      </div>
      <Sk className="h-2 rounded-full" />
      <div className="flex gap-2">
        <Sk className="h-6 w-16 rounded-full" />
        <Sk className="h-6 w-16 rounded-full" />
        <Sk className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

export default function ReactionsLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Sk className="h-10 w-10 rounded-xl flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Sk className="h-6 w-48" />
            <Sk className="h-3.5 w-64" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[88, 72, 112, 80, 88].map((w, i) => (
            <Sk key={i} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
