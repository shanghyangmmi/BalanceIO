import { Skeleton } from "@/components/ui/skeleton";

export function DataTableSkeleton({
    rowCount = 5,
    columnCount = 4,
    showToolbar = true,
}: {
    rowCount?: number;
    columnCount?: number;
    showToolbar?: boolean;
}) {
    return (
        <div className="w-full space-y-4">
            {showToolbar && (
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-[250px]" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-[100px]" />
                        <Skeleton className="h-10 w-[100px]" />
                    </div>
                </div>
            )}
            <div className="rounded-md border">
                <div className="border-b p-4">
                    <div className="flex gap-4">
                        {Array.from({ length: columnCount }).map((_, i) => (
                            <Skeleton key={i} className="h-6 flex-1" />
                        ))}
                    </div>
                </div>
                <div className="space-y-4 p-4">
                    {Array.from({ length: rowCount }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            {Array.from({ length: columnCount }).map((_, j) => (
                                <Skeleton key={j} className="h-4 flex-1" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
