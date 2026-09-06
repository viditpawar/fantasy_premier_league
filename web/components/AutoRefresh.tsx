"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          router.refresh();
          return seconds;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [router, seconds]);

  return (
    <span className="text-[11px] text-fg-subtle" suppressHydrationWarning>
      auto-refresh in {left}s
    </span>
  );
}
