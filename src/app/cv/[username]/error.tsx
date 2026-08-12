'use client'

import Link from 'next/link'
import { FileText, Home } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CivicCVError() {
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <FileText className="h-12 w-12 text-surface-500 opacity-40" />
        <h1 className="text-lg font-semibold text-white">Civic CV not found</h1>
        <p className="text-sm text-surface-500 max-w-xs">
          This profile doesn&apos;t exist or has not yet built a civic record.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300/50 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          <Home className="h-4 w-4" />
          Go home
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
