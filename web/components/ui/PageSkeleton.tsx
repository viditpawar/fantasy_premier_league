import { Skeleton } from "./Skeleton";

export function PageSkeleton({ variant = "grid" }: { variant?: "grid" | "table" | "pitch" }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <Skeleton className="mb-5 h-8 w-48" />
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
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
