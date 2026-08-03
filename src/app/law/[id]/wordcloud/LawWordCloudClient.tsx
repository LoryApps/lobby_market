'use client'

import Link from 'next/link'
import { ArrowLeft, Gavel } from 'lucide-react'
import { WordCloudView } from '@/components/topic/WordCloudView'
import { EmptyState } from '@/components/ui/EmptyState'

interface Props {
  topicId: string | null
  lawStatement: string
  lawCategory: string | null
  backHref: string
}

export function LawWordCloudClient({ topicId, lawStatement, lawCategory, backHref }: Props) {
  if (!topicId) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <div className="mb-5">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>
        </div>
        <EmptyState
          icon={Gavel}
          iconColor="text-gold"
          iconBg="bg-gold/10"
          iconBorder="border-gold/30"
          title="No argument data"
          description="This law has no linked debate topic to draw arguments from."
          action={{ label: 'Back to law', href: backHref }}
        />
      </div>
    )
  }

  return (
    <WordCloudView
      topicId={topicId}
      topicStatement={lawStatement}
      topicCategory={lawCategory}
      backHref={backHref}
    />
  )
}
