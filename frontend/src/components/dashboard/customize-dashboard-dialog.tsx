"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useDashboardPrefs } from "@/hooks/use-dashboard-prefs"
import { DASHBOARD_WIDGETS } from "@/config/dashboard-widgets"
import { ArrowDown, ArrowUp, GripVertical, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function CustomizeDashboardDialog() {
    const { visibleWidgets, widgetOrder, toggleWidget, moveWidget } = useDashboardPrefs()

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Customize
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Customize Dashboard</DialogTitle>
                    <DialogDescription>
                        Toggle visibility and reorder widgets to suit your workflow.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {widgetOrder.map((widgetId, index) => {
                        const widget = DASHBOARD_WIDGETS.find(w => w.id === widgetId);
                        if (!widget) return null;

                        const isVisible = visibleWidgets.includes(widgetId);

                        return (
                            <div key={widgetId} className={cn("flex items-center justify-between p-3 rounded-lg border bg-zinc-50/50 dark:bg-zinc-900/50", !isVisible && "opacity-60")}>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col gap-1">
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveWidget(widgetId, "up")} disabled={index === 0}>
                                            <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveWidget(widgetId, "down")} disabled={index === widgetOrder.length - 1}>
                                            <ArrowDown className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{widget.label}</div>
                                        <div className="text-xs text-muted-foreground">{widget.description}</div>
                                    </div>
                                </div>
                                <Switch
                                    checked={isVisible}
                                    onCheckedChange={() => toggleWidget(widgetId)}
                                />
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <Button type="submit">Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
