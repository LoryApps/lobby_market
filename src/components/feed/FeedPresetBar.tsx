'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, BookmarkCheck, Trash2, Plus, X, Check } from 'lucide-react'
import { useFeedStore } from '@/lib/stores/feed-store'
import type { FeedPreset } from '@/lib/stores/feed-store'
import { cn } from '@/lib/utils/cn'

const MODE_LABEL: Record<string, string> = {
  discover: 'Discover',
  following: 'Following',
  foryou: 'For You',
  mytags: 'My Tags',
  unvoted: 'Unvoted',
  battleground: 'Battleground',
  rising: 'Rising',
  closingin: 'Closing In',
  newlaws: 'New Laws',
  collapse: 'Collapse',
  argued: 'Argued',
  flux: 'Flux',
  lastcall: 'Last Call',
  momentum: 'Momentum',
  mandate: 'Mandate',
  elders: 'Elders',
  groundswell: 'Groundswell',
  livedebates: 'Live',
  swing: 'Swing',
  stalled: 'Stalled',
  comeback: 'Comeback',
  overdrive: 'Overdrive',
  deadlock: 'Deadlock',
  converging: 'Converging',
  flashpoint: 'Flashpoint',
}

function presetSummary(p: FeedPreset): string {
  const parts: string[] = [MODE_LABEL[p.feedMode] ?? p.feedMode]
  if (p.categoryFilter) parts.push(p.categoryFilter)
  if (p.statusFilter) parts.push(p.statusFilter)
  if (p.scopeFilter) parts.push(p.scopeFilter)
  return parts.join(' · ')
}

function hasActiveFilters(
  sort: string,
  statusFilter: string | null,
  categoryFilter: string | null,
  scopeFilter: string | null,
  tagFilter: string | null,
  feedMode: string
): boolean {
  return (
    sort !== 'top' ||
    statusFilter !== null ||
    categoryFilter !== null ||
    scopeFilter !== null ||
    tagFilter !== null ||
    feedMode !== 'discover'
  )
}

export function FeedPresetBar() {
  const {
    sort, statusFilter, categoryFilter, scopeFilter, tagFilter, feedMode,
    savedPresets, saveCurrentAsPreset, loadPreset, deletePreset,
  } = useFeedStore()

  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (saving) inputRef.current?.focus()
  }, [saving])

  const activeFilters = hasActiveFilters(sort, statusFilter, categoryFilter, scopeFilter, tagFilter, feedMode)

  function handleSave() {
    if (!name.trim()) return
    saveCurrentAsPreset(name)
    setName('')
    setSaving(false)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setSaving(false); setName('') }
  }

  if (savedPresets.length === 0 && !activeFilters) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto scrollbar-hide border-b border-surface-300/40">
      {/* Save button */}
      <AnimatePresence mode="wait">
        {saving ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-1 flex-shrink-0"
          >
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Name this view…"
              maxLength={30}
              className={cn(
                'text-xs bg-surface-200 border border-surface-400 rounded-lg px-2 py-1',
                'text-white placeholder:text-surface-500 outline-none focus:border-for-500/60',
                'w-32 transition-colors'
              )}
            />
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              aria-label="Save preset"
              className={cn(
                'p-1 rounded-lg transition-colors',
                name.trim()
                  ? 'text-emerald hover:bg-emerald/10'
                  : 'text-surface-500 cursor-not-allowed'
              )}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => { setSaving(false); setName('') }}
              aria-label="Cancel"
              className="p-1 rounded-lg text-surface-500 hover:text-surface-300 transition-colors"
            >
              <X size={13} />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="save-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSaving(true)}
            disabled={!activeFilters}
            aria-label="Save current view as preset"
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold',
              'border transition-all duration-150',
              justSaved
                ? 'text-emerald border-emerald/40 bg-emerald/10'
                : activeFilters
                ? 'text-surface-400 border-surface-400/40 hover:text-white hover:border-surface-400 hover:bg-surface-200/60 bg-transparent'
                : 'text-surface-600 border-surface-500/20 cursor-not-allowed'
            )}
          >
            {justSaved ? (
              <>
                <BookmarkCheck size={11} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Plus size={11} />
                <span>Save view</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Saved presets */}
      <AnimatePresence>
        {savedPresets.map((preset) => (
          <PresetChip
            key={preset.id}
            preset={preset}
            isDeleting={deletingId === preset.id}
            onLoad={() => loadPreset(preset)}
            onDeleteStart={() => setDeletingId(preset.id)}
            onDeleteCancel={() => setDeletingId(null)}
            onDeleteConfirm={() => { deletePreset(preset.id); setDeletingId(null) }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface PresetChipProps {
  preset: FeedPreset
  isDeleting: boolean
  onLoad: () => void
  onDeleteStart: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}

function PresetChip({ preset, isDeleting, onLoad, onDeleteStart, onDeleteCancel, onDeleteConfirm }: PresetChipProps) {
  const summary = presetSummary(preset)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className="flex-shrink-0 flex items-center"
    >
      {isDeleting ? (
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-against-500/50 bg-against-500/10 text-[11px] font-mono">
          <span className="text-against-400">Delete?</span>
          <button
            onClick={onDeleteConfirm}
            aria-label="Confirm delete"
            className="px-1.5 py-0.5 rounded text-against-300 hover:bg-against-500/20 transition-colors font-semibold"
          >
            Yes
          </button>
          <button
            onClick={onDeleteCancel}
            aria-label="Cancel delete"
            className="px-1.5 py-0.5 rounded text-surface-400 hover:text-white transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <div className="group flex items-center rounded-lg border border-surface-400/40 bg-surface-200/40 overflow-hidden hover:border-for-500/40 transition-colors">
          <button
            onClick={onLoad}
            title={summary}
            aria-label={`Load preset: ${preset.name}`}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono font-semibold text-surface-300 hover:text-white transition-colors"
          >
            <Bookmark size={10} className="text-surface-500 group-hover:text-for-400 transition-colors" />
            <span className="max-w-[96px] truncate">{preset.name}</span>
          </button>
          <button
            onClick={onDeleteStart}
            aria-label={`Delete preset: ${preset.name}`}
            className="px-1.5 py-1 text-surface-600 hover:text-against-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </motion.div>
  )
}
