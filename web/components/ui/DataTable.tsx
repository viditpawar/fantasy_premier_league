"use client";

import { type ReactNode, useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  sortValue?: (row: T) => number | string;
  render: (row: T, index: number) => ReactNode;
  hideBelow?: "sm" | "md" | "lg";
  headerClassName?: string;
}

const HIDE: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  initialSort,
  onRowClick,
  rowClassName,
  dense = false,
  emptyLabel = "Nothing to show",
}: {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  dense?: boolean;
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [data, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }

  const pad = dense ? "px-4 py-3" : "px-5 py-4";

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border bg-surface-0/50">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const alignCls =
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                return (
                  <th
                    key={col.key}
                    className={`${pad} ${alignCls} ${col.hideBelow ? HIDE[col.hideBelow] : ""} text-[9px] font-medium tracking-wide text-fg-muted ${col.headerClassName ?? ""}`}
                    aria-sort={col.sortValue ? active ? sort!.dir === "asc" ? "ascending" : "descending" : "none" : undefined}
                  >
                    {col.sortValue ? <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 py-1 hover:text-fg">
                      {col.header}
                        <span className={active ? "text-accent" : "text-fg-subtle/50"}>
                          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                    </button> : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className={`${pad} text-center text-fg-muted`}>
                  {emptyLabel}
                </td>
              </tr>
            )}
            {sorted.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onRowClick(row); } } : undefined}
                className={`border-b border-border/60 last:border-0 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-surface-2" : ""
                } ${rowClassName?.(row) ?? ""}`}
              >
                {columns.map((col) => {
                  const alignCls =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <td
                      key={col.key}
                      className={`${pad} ${alignCls} ${col.hideBelow ? HIDE[col.hideBelow] : ""} align-middle`}
                    >
                      {col.render(row, i)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
