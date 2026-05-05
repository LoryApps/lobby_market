import { create } from 'zustand'

interface SubscriptionState {
  /** Set of subscribed topic IDs */
  ids: Set<string>
  /** Whether the store has been loaded from the server */
  loaded: boolean
  loading: boolean

  load: () => Promise<void>
  toggle: (topicId: string) => Promise<void>
  isSubscribed: (topicId: string) => boolean
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,

  load: async () => {
    const { loaded, loading } = get()
    if (loaded || loading) return

    set({ loading: true })

    try {
      const res = await fetch('/api/topics/subscribed')
      if (!res.ok) return
      const data = (await res.json()) as { topics: { id: string }[] }
      set({ ids: new Set(data.topics.map((t) => t.id)), loaded: true })
    } catch {
      // Silent — store stays empty
    } finally {
      set({ loading: false })
    }
  },

  toggle: async (topicId: string) => {
    const { ids } = get()
    const wasSubscribed = ids.has(topicId)

    // Optimistic update
    const next = new Set(ids)
    if (wasSubscribed) {
      next.delete(topicId)
    } else {
      next.add(topicId)
    }
    set({ ids: next })

    try {
      const res = await fetch(`/api/topics/${topicId}/subscribe`, {
        method: wasSubscribed ? 'DELETE' : 'POST',
      })

      if (res.status === 401) {
        // Revert and redirect to login
        const reverted = new Set(get().ids)
        if (wasSubscribed) reverted.add(topicId)
        else reverted.delete(topicId)
        set({ ids: reverted })
        window.location.href = '/login'
        return
      }

      if (!res.ok) {
        // Revert on failure
        const reverted = new Set(get().ids)
        if (wasSubscribed) reverted.add(topicId)
        else reverted.delete(topicId)
        set({ ids: reverted })
      }
    } catch {
      // Revert on network error
      const reverted = new Set(get().ids)
      if (wasSubscribed) reverted.add(topicId)
      else reverted.delete(topicId)
      set({ ids: reverted })
    }
  },

  isSubscribed: (topicId: string) => get().ids.has(topicId),
}))
