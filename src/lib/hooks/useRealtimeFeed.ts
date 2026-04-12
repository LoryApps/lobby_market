"use client";

import { useEffect } from "react";
import { subscribeToFeed } from "@/lib/supabase/realtime";
import { useFeedStore } from "@/lib/stores/feed-store";
import type { Topic } from "@/lib/supabase/types";

export function useRealtimeFeed() {
  useEffect(() => {
    const channel = subscribeToFeed(
      (newTopic: Topic) => {
        const status = newTopic.status;
        if (status === "proposed" || status === "active" || status === "voting") {
          useFeedStore.getState().prependTopic(newTopic);
        }
      },
      (updatedTopic: Topic) => {
        useFeedStore.getState().updateTopic(updatedTopic.id, updatedTopic);
      }
    );

    return () => {
      channel.unsubscribe();
    };
  }, []);
}
