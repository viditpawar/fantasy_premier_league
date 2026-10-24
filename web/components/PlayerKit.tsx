/** Lightweight, locally rendered club-colour kits stay crisp at every scale. */
const KITS: Record<number, [string, string, boolean?]> = {
  3: ["#d7353a", "#fff"], 7: ["#91b5dc", "#7b3445"], 91: ["#d93840", "#242c32", true],
  94: ["#d74342", "#fff", true], 36: ["#3b76bf", "#fff", true], 8: ["#3273be", "#fff"],
  31: ["#3672b5", "#d94448", true], 11: ["#326cba", "#fff"], 54: ["#fff", "#202b30"],
  40: ["#385dab", "#fff"], 13: ["#2e65a8", "#fff"], 2: ["#fafafa", "#202b30", true],
  14: ["#d73943", "#fff"], 43: ["#83b9dd", "#fff"], 1: ["#ce3c42", "#fff"],
  4: ["#f5f5f5", "#26333a", true], 17: ["#d54643", "#fff"], 20: ["#f5f6f5", "#26354d"],
  21: ["#81394a", "#a2c5dc"], 39: ["#e5ac45", "#242d35"], 90: ["#a83e46", "#9dbcd9"],
  56: ["#d63c42", "#fff", true], 57: ["#e3c33d", "#438058"], 49: ["#e74846", "#fff", true],
};
export function PlayerKit({ code, goalkeeper = false, className = "pitch-kit" }: { code: number; goalkeeper?: boolean; className?: string }) {
  const [body, trim, striped] = goalkeeper ? ["#d8aa55", "#f7e7bd", false] : KITS[code] ?? ["#527d70", "#e8f1ec", false];
  return <svg viewBox="0 0 60 60" className={className} fill="none" aria-hidden="true"><path d="m20 7-8 5-9 11 10 8 5-6v28h24V25l5 6 10-8-9-11-8-5-10 4-10-4Z" fill={body} stroke="#172c3619" strokeWidth="1.2" />{striped && <><path d="M22 11v41m8-40v40m8-41v41" stroke={trim} strokeWidth="4" /></>}<path d="m20 7 10 4 10-4-3 7H23l-3-7Z" fill={trim} /><path d="m3 23 10 8 2-3-10-8-2 3Zm54 0-10 8-2-3 10-8 2 3Z" fill={trim} /><path d="M18 48h24v5H18z" fill="#000" opacity=".04" /><path d="M22 31h16" stroke={trim} opacity=".7" strokeWidth="2.5" strokeLinecap="round" /><circle cx="36" cy="22" r="2.2" fill={trim} opacity=".9" /></svg>;
}
