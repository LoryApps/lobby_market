'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function IssueDetailError() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm font-mono text-against-400">Could not load this issue.</p>
        <Link
          href="/issues"
          className="flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Issues
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
