"use client";

import { useEffect, useState } from "react";

type Urgency = "calm" | "amber" | "urgent";

interface TimerState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  urgency: Urgency;
}

const EXPIRED_STATE: TimerState = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isExpired: true,
  urgency: "urgent",
};

function calculateTimeLeft(endsAt: string): TimerState {
  const diff = new Date(endsAt).getTime() - Date.now();

  if (diff <= 0) {
    return EXPIRED_STATE;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const totalHours = diff / (1000 * 60 * 60);
  let urgency: Urgency = "calm";
  if (totalHours < 1) {
    urgency = "urgent";
  } else if (totalHours < 24) {
    urgency = "amber";
  }

  return { days, hours, minutes, seconds, isExpired: false, urgency };
}

export function useTimer(endsAt: string | null) {
  const [timer, setTimer] = useState<TimerState>(() =>
    endsAt ? calculateTimeLeft(endsAt) : EXPIRED_STATE
  );

  useEffect(() => {
    if (!endsAt) {
      setTimer(EXPIRED_STATE);
      return;
    }

    setTimer(calculateTimeLeft(endsAt));

    const interval = setInterval(() => {
      const next = calculateTimeLeft(endsAt);
      setTimer(next);

      if (next.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [endsAt]);

  return timer;
}
