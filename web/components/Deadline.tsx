"use client";
import { useEffect, useState } from "react";
import { countdown, countdownLabel } from "@/lib/format";
export function Deadline({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!deadline) return <span>Next deadline to be confirmed</span>;
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Phoenix" }).format(new Date(deadline));
  return <span>{now == null ? `${date} MST` : countdownLabel(countdown(deadline, now))}<span className="ml-1.5 text-[8px] font-normal text-[#b7cabe]">{now != null && !countdown(deadline, now)?.past ? "remaining" : ""}</span></span>;
}
