'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

const NAME_MAX = 60
const DESC_MAX = 500

export function CoalitionBuilder() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [maxMembers, setMaxMembers] = useState(100)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/coalitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          is_public: isPublic,
          max_members: maxMembers,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(body.error ?? 'Failed to create coalition')
      }
      const data = await res.json()
      router.push(`/coalitions/${data.coalition.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 text-purple">
        <Users className="h-5 w-5" />
        <h2 className="font-mono text-lg font-semibold text-white">
          Forge a Coalition
        </h2>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
          Coalition Name
        </label>
        <input
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., The Open Web Alliance"
          className={cn(
            'w-full rounded-xl px-4 py-3 font-mono text-sm',
            'bg-surface-200 border border-surface-300 text-white',
            'placeholder:text-surface-500',
            'focus:outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/20'
          )}
        />
        <div className="text-right text-[11px] font-mono text-surface-500">
          {name.length}/{NAME_MAX}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
          Description
        </label>
        <textarea
          value={description}
          maxLength={DESC_MAX}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your coalition stand for? What unites its members?"
          rows={5}
          className={cn(
            'w-full rounded-xl px-4 py-3 font-mono text-sm',
            'bg-surface-200 border border-surface-300 text-white',
            'placeholder:text-surface-500 resize-y',
            'focus:outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/20'
          )}
        />
        <div className="text-right text-[11px] font-mono text-surface-500">
          {description.length}/{DESC_MAX}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
            Max Members
          </label>
          <input
            type="number"
            min={2}
            max={500}
            step={1}
            value={maxMembers}
            onChange={(e) =>
              setMaxMembers(
                Math.min(Math.max(Number(e.target.value), 2), 500)
              )
            }
            className={cn(
              'w-full rounded-xl px-4 py-3 font-mono text-sm',
              'bg-surface-200 border border-surface-300 text-white',
              'focus:outline-none focus:border-purple/50 focus:ring-2 focus:ring-purple/20'
            )}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500">
            Visibility
          </label>
          <div className="flex h-[46px] items-center gap-3 rounded-xl bg-surface-200 border border-surface-300 px-4">
            <input
              type="checkbox"
              id="is_public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-purple focus:ring-purple/40"
            />
            <label
              htmlFor="is_public"
              className="font-mono text-xs text-surface-700 cursor-pointer"
            >
              Publicly discoverable
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="gold"
        size="lg"
        className="w-full"
        disabled={submitting || !name.trim()}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <Users className="h-4 w-4" />
            Create Coalition
          </>
        )}
      </Button>
    </form>
  )
}
