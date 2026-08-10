'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DebateHubError() {
  return (
    <>
      <TopBar />
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
          <p className="font-mono text-sm text-surface-500">Failed to load debates for this topic.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
