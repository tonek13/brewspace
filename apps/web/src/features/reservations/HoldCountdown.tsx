"use client";

import { useEffect, useState } from "react";

export function HoldCountdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Math.max(0, expiresAt - Date.now());
      setRemaining(next);
      if (next <= 0) onExpire();
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const low = totalSeconds <= 60;

  return (
    <span className={`font-mono text-sm font-medium ${low ? "text-clay" : "text-crema-deep"}`}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
