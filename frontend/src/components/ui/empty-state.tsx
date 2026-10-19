import { LucideIcon, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export function EmptyState({
    title,
    description,
    icon: Icon = FileX,
    actionLabel,
    onAction,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-foreground/15 px-8 py-16 text-center animate-in fade-in-50",
                className
            )}
        >
            <Icon className="h-5 w-5 text-muted-foreground/70" strokeWidth={1.5} />
            <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
            <p className="mb-6 mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                {description}
            </p>
            {actionLabel && onAction && (
                <Button onClick={onAction} variant="outline">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
