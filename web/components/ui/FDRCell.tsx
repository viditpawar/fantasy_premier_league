import { fdrColor, fdrLabel } from "@/lib/format";

export function FDRCell({
  opponent,
  wasHome,
  difficulty,
  size = "md",
}: {
  opponent: string;
  wasHome: boolean;
  difficulty: number | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "text-[10px] px-1 py-0.5" : "text-[11px] px-1.5 py-1";
  return (
    <span
      className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md font-bold text-white ${dim}`}
      style={{ background: fdrColor(difficulty) }}
      title={`${opponent} (${wasHome ? "Home" : "Away"}) — ${fdrLabel(difficulty)}`}
    >
      <span className="truncate">{opponent}</span>
      <span className="opacity-70">{wasHome ? "H" : "A"}</span>
    </span>
  );
}

export function FDRDot({ difficulty }: { difficulty: number | null | undefined }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: fdrColor(difficulty) }}
      title={fdrLabel(difficulty)}
    />
  );
}
