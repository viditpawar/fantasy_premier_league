import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" aria-label="FPL Cockpit home"><span className="brand-symbol"><svg width="23" height="25" viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M5 5h14v19H5zM5 14h14" stroke="currentColor" strokeWidth="1.2" opacity=".85" /><circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.2" /><path d="M9 5v4h6V5M9 24v-4h6v4M9 2h6" stroke="currentColor" strokeWidth="1.2" /></svg></span><div><div className="brand-name">FPL<span> cockpit</span><span className="text-accent">.</span></div>{!compact && <div className="brand-caption">A clearer view of the game</div>}</div></Link>;
}
