import { Skeleton } from "./Skeleton";

export function PageSkeleton({ variant = "grid" }: { variant?: "grid" | "table" | "pitch" }) {
  return (
    <main className="page-container" aria-label="Loading your workspace" aria-busy="true">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-3 h-10 w-64" />
      <Skeleton className="mb-7 h-3 w-72 max-w-full" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      {variant === "pitch" && <Skeleton className="h-[420px] rounded-2xl" />}
      {variant === "grid" && (
        <div className="grid gap-4">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      )}
      {variant === "table" && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}
    </main>
  );
}
