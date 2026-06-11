import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  init: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  init: () => {
    const supabase = createClient()

    // Get current user immediately
    supabase.auth.getUser().then(({ data }) => {
      set({ user: data.user ?? null, loading: false, initialized: true })
    })

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false, initialized: true })
    })
  },
}))
