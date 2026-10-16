"use client"

import * as React from "react"
import {
    ColumnDef,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Input } from "@/components/ui/input"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

interface VirtualDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    isLoading?: boolean
    filterColumn?: string
    filterPlaceholder?: string
    /** Row height in px — keep constant for buttery scrolling. */
    rowHeight?: number
    /** Viewport height, e.g. "calc(100vh - 420px)" or 600. */
    height?: number | string
    /** Called when the user scrolls near the end — hook up fetchNextPage for infinite feeds. */
    onEndReached?: () => void
}

/**
 * Zero-Lag virtualized table (TanStack Table + TanStack Virtual).
 *
 * Only the ~25 visible rows exist in the DOM regardless of dataset size,
 * so a 10,000-row general ledger scrolls at 60fps with no UI-thread
 * freezes. Pair with useJournalEntriesInfinite + onEndReached for
 * server-paged infinite scrolling.
 */
export function VirtualDataTable<TData, TValue>({
    columns,
    data,
    isLoading = false,
    filterColumn,
    filterPlaceholder = "Filter...",
    rowHeight = 44,
    height = 600,
    onEndReached,
}: VirtualDataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const parentRef = React.useRef<HTMLDivElement>(null)

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const { rows } = table.getRowModel()

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 12,
    })

    const virtualRows = virtualizer.getVirtualItems()

    // Infinite-scroll trigger: fire when the last rendered row is within
    // 10 rows of the end of the loaded dataset.
    React.useEffect(() => {
        if (!onEndReached || virtualRows.length === 0) return
        const last = virtualRows[virtualRows.length - 1]
        if (last.index >= rows.length - 10) onEndReached()
    }, [virtualRows, rows.length, onEndReached])

    if (isLoading) return <DataTableSkeleton columnCount={columns.length} />

    return (
        <div className="space-y-3">
            {filterColumn && (
                <Input
                    placeholder={filterPlaceholder}
                    value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                    onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)}
                    className="max-w-sm"
                />
            )}

            <div className="rounded-md border overflow-hidden">
                {/* Sticky header (plain grid — outside the scroll body) */}
                <div className="bg-muted/50 border-b">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <div key={headerGroup.id} className="flex w-full">
                            {headerGroup.headers.map((header) => (
                                <div
                                    key={header.id}
                                    className={cn(
                                        "flex-1 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none",
                                        header.column.getCanSort() && "cursor-pointer hover:text-foreground transition-colors"
                                    )}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(header.column.columnDef.header, header.getContext())}
                                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Virtualized body */}
                {rows.length === 0 ? (
                    <EmptyState title="No records" description="Nothing to display yet." />
                ) : (
                    <div
                        ref={parentRef}
                        style={{ height, overflowY: "auto", contain: "strict" }}
                    >
                        <div
                            style={{
                                height: virtualizer.getTotalSize(),
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {virtualRows.map((virtualRow) => {
                                const row = rows[virtualRow.index]
                                return (
                                    <div
                                        key={row.id}
                                        data-index={virtualRow.index}
                                        className={cn(
                                            "flex w-full items-center border-b border-border/50 text-sm transition-colors hover:bg-muted/40",
                                            virtualRow.index % 2 === 1 && "bg-muted/20"
                                        )}
                                        style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: virtualRow.size,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <div key={cell.id} className="flex-1 px-4 truncate">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground text-right font-money">
                {rows.length.toLocaleString("id-ID")} rows · virtualized
            </p>
        </div>
    )
}
