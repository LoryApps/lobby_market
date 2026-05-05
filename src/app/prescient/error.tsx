'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function PrescientError() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 text-center gap-4">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <p className="text-surface-400 font-mono text-sm">Failed to load alignment data.</p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Back to feed</Link>
        </Button>
      </main>
      <BottomNav />
    </div>
  )
}
