"use client"

import { useState } from "react"
import { apiClient, SupportTicket } from "@/lib/api-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
    LifeBuoy,
    Loader2,
    ShieldCheck,
    CheckCircle2,
    Lock,
    AlertCircle,
} from "lucide-react"

interface SupportTicketDialogProps {
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    onTicketCreated?: (ticket: SupportTicket) => void
}

export function SupportTicketDialog({
    trigger,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    onTicketCreated,
}: SupportTicketDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? setControlledOpen! : setInternalOpen

    const [subject, setSubject] = useState("")
    const [description, setDescription] = useState("")
    const [priority, setPriority] = useState<string>("1") // 1 = Normal
    const [grantTemporaryAccess, setGrantTemporaryAccess] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [createdTicket, setCreatedTicket] = useState<SupportTicket | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!subject.trim()) {
            setError("Subject is required")
            return
        }
        if (!description.trim()) {
            setError("Description is required")
            return
        }

        try {
            setIsSubmitting(true)
            setError(null)
            const ticket = await apiClient.createSupportTicket({
                subject: subject.trim(),
                description: description.trim(),
                priority: parseInt(priority, 10),
                grantTemporaryAccess,
            })
            setCreatedTicket(ticket)
            toast.success(`Support ticket ${ticket.ticketNumber} created successfully`)
            onTicketCreated?.(ticket)
        } catch (err: any) {
            setError(err?.message || "Failed to create support ticket")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReset = () => {
        setSubject("")
        setDescription("")
        setPriority("1")
        setGrantTemporaryAccess(false)
        setCreatedTicket(null)
        setError(null)
    }

    const handleDialogChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            handleReset()
        }
        setOpen(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[540px]">
                {createdTicket ? (
                    <div className="py-6 space-y-4 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold">Support ticket created</h3>
                            <p className="text-sm text-muted-foreground">
                                Your reference number is{" "}
                                <span className="font-mono font-semibold text-foreground">
                                    {createdTicket.ticketNumber}
                                </span>
                            </p>
                        </div>

                        {createdTicket.grantedAccessExpiry && (
                            <div className="p-3 bg-muted/50 rounded-lg border text-left text-xs space-y-1">
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                    <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                                    Temporary diagnostic access granted
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    Engineering support has been granted 24-hour read-only diagnostic access, expiring at{" "}
                                    <span className="font-mono">
                                        {new Date(createdTicket.grantedAccessExpiry).toLocaleString()}
                                    </span>
                                    .
                                </p>
                            </div>
                        )}

                        <div className="pt-2">
                            <Button onClick={() => handleDialogChange(false)} className="w-full">
                                Done
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <LifeBuoy className="h-5 w-5 text-primary" />
                                Contact support & report issue
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Submit a diagnostic request directly to BalanceIO platform support engineers.
                            </DialogDescription>
                        </DialogHeader>

                        {error && (
                            <div className="flex items-start gap-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="subject" className="text-xs font-medium">
                                    Subject
                                </Label>
                                <Input
                                    id="subject"
                                    placeholder="Brief summary of the issue (e.g., Trial balance rounding difference)"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    maxLength={200}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="priority" className="text-xs font-medium">
                                    Priority
                                </Label>
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger id="priority" className="w-full">
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Low — Question or general inquiry</SelectItem>
                                        <SelectItem value="1">Normal — Minor error or workflow question</SelectItem>
                                        <SelectItem value="2">High — Document posting or calculation issue</SelectItem>
                                        <SelectItem value="3">Urgent — Period close or reporting blocker</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-xs font-medium">
                                    Description & reproduction steps
                                </Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe what occurred, expected outcome, and document numbers involved..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    required
                                />
                            </div>

                            {/* 24-hour Diagnostic Access Consent */}
                            <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                                <Checkbox
                                    id="grantAccess"
                                    checked={grantTemporaryAccess}
                                    onCheckedChange={(checked) => setGrantTemporaryAccess(!!checked)}
                                    className="mt-1"
                                />
                                <div className="space-y-1 text-xs">
                                    <Label htmlFor="grantAccess" className="font-medium cursor-pointer flex items-center gap-1.5">
                                        <Lock className="h-3 w-3 text-primary" />
                                        Grant 24-hour read-only diagnostic access
                                    </Label>
                                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                                        Under Indonesian tax privacy and tenant isolation laws (UU KUP Pasal 28), support engineers cannot inspect tenant financial records without explicit consent. Checking this creates a 24-hour read-only token scoped specifically to this ticket.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleDialogChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="gap-2">
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Submit ticket
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
