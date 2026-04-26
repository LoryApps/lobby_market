'use client'

import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BountiesError() {
  return (
    <>
      <div className="min-h-screen bg-surface-50 pb-24 flex flex-col">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <AlertCircle className="h-10 w-10 text-against-400" />
          <h1 className="text-lg font-semibold text-white">Failed to load bounties</h1>
          <Link
            href="/"
            className="text-sm text-for-400 hover:text-for-300 transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
