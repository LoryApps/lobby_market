'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { DmConversation } from '@/lib/supabase/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'now'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessagesButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<DmConversation[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [justArrived, setJustArrived] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const prevUnreadRef = useRef(0)

  // Flash animation when new message arrives
  useEffect(() => {
    if (totalUnread > prevUnreadRef.current) {
      setJustArrived(true)
      const t = setTimeout(() => setJustArrived(false), 2000)
      return () => clearTimeout(t)
    }
    prevUnreadRef.current = totalUnread
  }, [totalUnread])

  // Get unread count from Supabase directly (lightweight, no conversation grouping)
  const loadUnreadCount = useCallback(async (uid: string) => {
    const supabase = createClient()
    const { count } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', uid)
      .eq('is_read', false)
    setTotalUnread(count ?? 0)
  }, [])

  // Load conversations for the dropdown
  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/messages')
      if (res.ok) {
        const data = await res.json()
        setConversations((data.conversations ?? []).slice(0, 6))
        setTotalUnread(data.totalUnread ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load: get user + unread count
  useEffect(() => {
    let active = true
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) return
      setUserId(user.id)
      await loadUnreadCount(user.id)
    }
    init()
    return () => { active = false }
  }, [loadUnreadCount])

  // Realtime: subscribe to new DMs addressed to this user
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dm_badge:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          // Re-fetch unread count when a new message arrives
          loadUnreadCount(userId)
          // If dropdown is open, refresh conversations
          if (isOpen) loadConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          loadUnreadCount(userId)
          if (isOpen) loadConversations()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, isOpen, loadUnreadCount, loadConversations])

  // Load conversations when dropdown opens
  useEffect(() => {
    if (isOpen) loadConversations()
  }, [isOpen, loadConversations])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  // Guest state — show plain icon
  if (!userId) {
    return (
      <Link
        href="/login"
        aria-label="Messages — sign in to view"
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        aria-label={`Messages${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
          'bg-surface-200 border-surface-300 text-surface-500',
          'hover:bg-surface-300 hover:text-white',
          isOpen && 'bg-surface-300 text-white border-surface-400'
        )}
      >
        <motion.div
          animate={justArrived ? { rotate: [-8, 8, -6, 6, -4, 4, 0] } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
        </motion.div>

        {/* Unread badge */}
        <AnimatePresence>
          {totalUnread > 0 && (
            <motion.span
              key="dm-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-for-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-surface-100"
            >
              {totalUnread > 9 ? '9+' : totalUnread}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Ping ring on new message */}
        {justArrived && (
          <span className="absolute inset-0 rounded-lg animate-ping bg-for-500/30 pointer-events-none" />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 z-50 rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
            style={{ minWidth: '300px', maxWidth: '340px' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-surface-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-white font-mono">Messages</span>
                {totalUnread > 0 && (
                  <span className="text-[10px] font-mono text-surface-500">
                    {totalUnread} unread
                  </span>
                )}
              </div>
              <Link
                href="/messages/new"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                aria-label="New message"
              >
                <Pencil className="h-3 w-3" />
                New
              </Link>
            </div>

            {/* Conversation list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-surface-300/60">
              {loading && conversations.length === 0 ? (
                <div className="px-4 py-6 flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="h-9 w-9 rounded-full bg-surface-300 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-28 bg-surface-300 rounded" />
                        <div className="h-3 w-40 bg-surface-300/60 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 mx-auto mb-3">
                    <MessageSquare className="h-5 w-5 text-surface-500" />
                  </div>
                  <p className="text-xs font-mono text-surface-500">No messages yet</p>
                  <p className="text-[11px] text-surface-600 mt-0.5">
                    Start a conversation from any profile page.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <Link
                    key={conv.partner.id}
                    href={`/messages/${conv.partner.username}`}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors group',
                      conv.unread_count > 0 && 'bg-for-500/[0.04]'
                    )}
                  >
                    {/* Avatar with unread indicator */}
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={conv.partner.avatar_url}
                        fallback={conv.partner.display_name ?? conv.partner.username}
                        size="sm"
                        className="h-9 w-9"
                      />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-for-500 border-2 border-surface-100 flex items-center justify-center text-[8px] font-bold text-white">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Message preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-xs font-semibold truncate',
                          conv.unread_count > 0 ? 'text-white' : 'text-surface-300'
                        )}>
                          {conv.partner.display_name ?? conv.partner.username}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                          {relativeTime(conv.last_message_at)}
                        </span>
                      </div>
                      <p className={cn(
                        'text-[11px] truncate mt-0.5',
                        conv.unread_count > 0 ? 'text-surface-300' : 'text-surface-600'
                      )}>
                        {conv.last_sender_id !== conv.partner.id && (
                          <span className="text-surface-500">You: </span>
                        )}
                        {conv.last_message}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Footer */}
            <Link
              href="/messages"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 text-center text-xs font-mono font-semibold text-for-400 border-t border-surface-300 hover:bg-surface-200 transition-colors"
            >
              View all messages →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
