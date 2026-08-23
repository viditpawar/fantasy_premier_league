export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card relative overflow-hidden px-4 py-3.5">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-green))" }}
      />
      <div className="text-2xl font-extrabold tracking-tight text-white">{value}</div>
      <div className="mt-1 section-label">{label}</div>
    </div>
  );
}
