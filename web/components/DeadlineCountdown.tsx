"use client";
import { useSyncExternalStore } from "react";

const subscribe = (callback: () => void) => { const timer = setInterval(callback, 1000); return () => clearInterval(timer); };
const getSnapshot = () => Math.floor(Date.now() / 1000);
const getServerSnapshot = () => null;
export function DeadlineCountdown({ deadline }: { deadline: string | null }) {
  const now = useSyncExternalStore<number | null>(subscribe, getSnapshot, getServerSnapshot);
  const end = deadline ? Date.parse(deadline) : NaN;
  if (!Number.isFinite(end)) return <p className="countdown-empty">The next deadline hasn&apos;t been announced.</p>;
  const seconds = now == null ? null : Math.max(0, Math.floor(end / 1000) - now);
  const values = seconds == null ? [null, null, null, null] : [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return <div className="deadline-countdown" role="timer" aria-label={seconds === 0 ? "Deadline passed" : "Time until the next gameweek deadline"}>
    {values.map((n, i) => <div key={i}><strong>{n == null ? "—" : String(n).padStart(2, "0")}</strong><span>{["Days", "Hours", "Mins", "Secs"][i]}</span></div>)}
    {seconds === 0 && <p className="countdown-passed">Deadline passed. Review the next available gameweek.</p>}
  </div>;
}
