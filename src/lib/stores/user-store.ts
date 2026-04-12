import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/supabase/types";

const DAILY_VOTE_LIMITS: Record<UserRole, number> = {
  person: 10,
  debator: 20,
  troll_catcher: 30,
  elder: 50,
};

interface UserState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  canVote: () => boolean;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,

  setUser: (user) => set({ user }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch profile:", error.message);
        return;
      }

      set({ profile: data });
    } finally {
      set({ isLoading: false });
    }
  },

  canVote: () => {
    const { profile } = get();
    if (!profile) return false;

    const limit = DAILY_VOTE_LIMITS[profile.role];
    const resetAt = new Date(profile.daily_votes_reset_at);
    const now = new Date();

    // If the reset time has passed, votes are effectively 0
    if (now > resetAt) return true;

    return profile.daily_votes_used < limit;
  },
}));
