import { create } from 'zustand'

interface ThesisWatchState {
  ids: Set<string>
  loaded: boolean
  loading: boolean

  load: () => Promise<void>
  toggle: (thesisId: string) => Promise<void>
  isWatching: (thesisId: string) => boolean
}

export const useThesisWatchStore = create<ThesisWatchState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,

  load: async () => {
    const { loaded, loading } = get()
    if (loaded || loading) return
    set({ loading: true })
    try {
      const res = await fetch('/api/thesis/watching')
      if (!res.ok) return
      const data = (await res.json()) as { theses: { id: string }[] }
      set({ ids: new Set(data.theses.map((t) => t.id)), loaded: true })
    } catch {
      // Silent
    } finally {
      set({ loading: false })
    }
  },

  toggle: async (thesisId: string) => {
    const { ids } = get()
    const wasWatching = ids.has(thesisId)
    const next = new Set(ids)
    if (wasWatching) next.delete(thesisId)
    else next.add(thesisId)
    set({ ids: next })

    try {
      const res = await fetch(`/api/thesis/${thesisId}/watch`, {
        method: wasWatching ? 'DELETE' : 'POST',
      })
      if (res.status === 401) {
        // Revert
        const reverted = new Set(get().ids)
        if (wasWatching) reverted.add(thesisId)
        else reverted.delete(thesisId)
        set({ ids: reverted })
        window.location.href = '/sign-in'
      }
    } catch {
      // Revert on network error
      const reverted = new Set(get().ids)
      if (wasWatching) reverted.add(thesisId)
      else reverted.delete(thesisId)
      set({ ids: reverted })
    }
  },

  isWatching: (thesisId: string) => get().ids.has(thesisId),
}))
