"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    let remaining = seconds;
    const tick = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { router.refresh(); remaining = seconds; }
      setLeft(remaining);
    }, 1000);
    return () => clearInterval(tick);
  }, [router, seconds]);

  return (
    <span className="text-[11px] text-fg-subtle" suppressHydrationWarning>
      Snapshot refresh in {left}s
    </span>
  );
}
