import { create } from "zustand";
import type { VoteSide } from "@/lib/supabase/types";

interface VoteState {
  pendingVotes: Map<string, VoteSide>;
  confirmedVotes: Map<string, VoteSide>;
  castVote: (topicId: string, side: VoteSide) => Promise<void>;
  hasVoted: (topicId: string) => boolean;
  getVoteSide: (topicId: string) => VoteSide | null;
}

export const useVoteStore = create<VoteState>((set, get) => ({
  pendingVotes: new Map(),
  confirmedVotes: new Map(),

  castVote: async (topicId, side) => {
    const { pendingVotes, confirmedVotes } = get();

    // Already voted on this topic
    if (confirmedVotes.has(topicId) || pendingVotes.has(topicId)) return;

    // Set optimistic pending vote
    const nextPending = new Map(pendingVotes);
    nextPending.set(topicId, side);
    set({ pendingVotes: nextPending });

    try {
      const res = await fetch(`/api/topics/${topicId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side }),
      });

      if (!res.ok) {
        throw new Error(`Vote failed: ${res.statusText}`);
      }

      // Move from pending to confirmed
      set((state) => {
        const updatedPending = new Map(state.pendingVotes);
        updatedPending.delete(topicId);

        const updatedConfirmed = new Map(state.confirmedVotes);
        updatedConfirmed.set(topicId, side);

        return {
          pendingVotes: updatedPending,
          confirmedVotes: updatedConfirmed,
        };
      });
    } catch (error) {
      // Remove from pending on failure
      console.error("Vote error:", error);
      set((state) => {
        const updatedPending = new Map(state.pendingVotes);
        updatedPending.delete(topicId);
        return { pendingVotes: updatedPending };
      });
    }
  },

  hasVoted: (topicId) => {
    const { pendingVotes, confirmedVotes } = get();
    return pendingVotes.has(topicId) || confirmedVotes.has(topicId);
  },

  getVoteSide: (topicId) => {
    const { confirmedVotes, pendingVotes } = get();
    return confirmedVotes.get(topicId) ?? pendingVotes.get(topicId) ?? null;
  },
}));
