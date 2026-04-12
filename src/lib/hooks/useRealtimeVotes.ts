"use client";

import { useEffect, useState } from "react";
import { subscribeToTopic } from "@/lib/supabase/realtime";
import { useFeedStore } from "@/lib/stores/feed-store";
import type { Topic, TopicStatus } from "@/lib/supabase/types";

interface RealtimeVoteState {
  bluePct: number;
  blueVotes: number;
  redVotes: number;
  totalVotes: number;
  status: TopicStatus;
}

export function useRealtimeVotes(topicId: string) {
  const [voteState, setVoteState] = useState<RealtimeVoteState | null>(null);

  useEffect(() => {
    if (!topicId) return;

    const channel = subscribeToTopic(topicId, (updated: Partial<Topic>) => {
      setVoteState({
        bluePct: updated.blue_pct ?? 0,
        blueVotes: updated.blue_votes ?? 0,
        redVotes: updated.red_votes ?? 0,
        totalVotes: updated.total_votes ?? 0,
        status: updated.status ?? "proposed",
      });

      useFeedStore.getState().updateTopic(topicId, updated);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [topicId]);

  return voteState;
}
