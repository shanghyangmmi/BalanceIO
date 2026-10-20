"use client"

import type { ReactNode } from "react"
import { CloudOff, FileText, Loader2, RotateCcw, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FileDropZone, formatBytes } from "@/components/attachments/file-drop-zone"
import { useAttachments, useAttachmentStorage } from "@/hooks/use-attachments"
import { downloadAttachment } from "@/hooks/use-attachment-blob"

/** The entity type the attachments API files journal evidence under. */
export const JOURNAL_ATTACHMENT_TYPE = "JournalEntry"

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

interface JournalAttachmentsProps {
    /** The saved entry, if there is one yet. */
    entryId?: string
    /** Chosen here, uploaded by the form once the entry is saved. */
    pending: File[]
    onPendingChange: (files: File[]) => void
    /** Saved attachments to delete when the entry is saved. */
    removed: string[]
    onRemovedChange: (ids: string[]) => void
    canAttach: boolean
    canRemove: boolean
    disabled?: boolean
}

/**
 * Supporting evidence for a journal entry. Like every other field on the
 * form, nothing changes until the entry is saved: new files wait in
 * `pending`, removals in `removed`, and "Cancel" leaves both untouched on
 * the server.
 */
export function JournalAttachments({
    entryId,
    pending,
    onPendingChange,
    removed,
    onRemovedChange,
    canAttach,
    canRemove,
    disabled,
}: JournalAttachmentsProps) {
    const storage = useAttachmentStorage()
    const saved = useAttachments(JOURNAL_ATTACHMENT_TYPE, entryId)
    const savedList = saved.data ?? []
    const hasItems = savedList.length > 0 || pending.length > 0

    const addFiles = (files: File[]) => {
        const known = new Set(pending.map(fileKey))
        onPendingChange([...pending, ...files.filter(f => !known.has(fileKey(f)))])
    }

    const download = (id: string, fileName: string) =>
        downloadAttachment(id, fileName).catch((e) =>
            toast.error(`Could not download ${fileName}`, { description: e instanceof Error ? e.message : undefined }),
        )

    let picker: ReactNode = null
    if (canAttach) {
        if (storage.isPending) {
            picker = <Notice compact={hasItems}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking file storage…</Notice>
        } else if (storage.isError) {
            picker = (
                <Notice compact={hasItems} icon>
                    File storage could not be reached, so files cannot be added right now.
                </Notice>
            )
        } else if (!storage.data.available) {
            picker = (
                <Notice compact={hasItems} icon title="Attachments are unavailable">
                    File storage is not configured on this server, so files cannot be kept.
                </Notice>
            )
        } else {
            picker = (
                <FileDropZone
                    onFiles={addFiles}
                    extensions={storage.data.extensions}
                    maxBytes={storage.data.maxFileBytes}
                    disabled={disabled}
                    compact={hasItems}
                />
            )
        }
    } else if (!hasItems && !saved.isPending && !saved.isError) {
        picker = <Notice>No attachments.</Notice>
    }

    return (
        <div className="space-y-2">
            {picker}

            {entryId && saved.isPending && (
                <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading attachments…
                </p>
            )}
            {saved.isError && (
                <p className="px-1 text-xs text-destructive">The saved attachments could not be loaded.</p>
            )}

            {hasItems && (
                <ul className="divide-y divide-foreground/[0.06] rounded-lg border border-foreground/10">
                    {savedList.map((a) => {
                        const isRemoved = removed.includes(a.id)
                        return (
                            <Row
                                key={a.id}
                                name={a.fileName}
                                onOpen={() => download(a.id, a.fileName)}
                                struck={isRemoved}
                                meta={isRemoved ? "Removed on save" : formatBytes(a.fileSize)}
                                action={canRemove && (isRemoved ? (
                                    <RowButton label={`Keep ${a.fileName}`} disabled={disabled} onClick={() => onRemovedChange(removed.filter(id => id !== a.id))}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </RowButton>
                                ) : (
                                    <RowButton label={`Remove ${a.fileName}`} disabled={disabled} onClick={() => onRemovedChange([...removed, a.id])}>
                                        <X className="h-3.5 w-3.5" />
                                    </RowButton>
                                ))}
                            />
                        )
                    })}
                    {pending.map((f) => (
                        <Row
                            key={fileKey(f)}
                            name={f.name}
                            meta={`${formatBytes(f.size)} · attached on save`}
                            action={
                                <RowButton label={`Remove ${f.name}`} disabled={disabled} onClick={() => onPendingChange(pending.filter(p => p !== f))}>
                                    <X className="h-3.5 w-3.5" />
                                </RowButton>
                            }
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}

function Notice({ children, title, icon, compact }: { children: ReactNode; title?: string; icon?: boolean; compact?: boolean }) {
    return (
        <div
            className={cn(
                "flex rounded-lg border border-foreground/10 text-xs text-muted-foreground",
                compact ? "items-start gap-2 px-3 py-2.5" : "min-h-32 flex-col items-center justify-center gap-1.5 p-4 text-center",
            )}
        >
            {icon && <CloudOff className={cn("h-4 w-4 shrink-0", compact && "mt-px")} />}
            <div className={cn("space-y-0.5", !compact && "max-w-[32ch]")}>
                {title && <p className="text-sm font-medium text-foreground">{title}</p>}
                <p className={cn("flex items-center gap-2", !compact && "justify-center")}>{children}</p>
            </div>
        </div>
    )
}

function Row({ name, meta, onOpen, struck, action }: { name: string; meta: string; onOpen?: () => void; struck?: boolean; action?: ReactNode }) {
    const label = cn("block max-w-full truncate text-left text-sm", struck && "text-muted-foreground line-through")
    return (
        <li className="flex items-center gap-2.5 py-1.5 pl-3 pr-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
                {onOpen ? (
                    <button type="button" onClick={onOpen} title={`Download ${name}`} className={cn(label, "hover:underline underline-offset-4")}>
                        {name}
                    </button>
                ) : (
                    <span className={label} title={name}>{name}</span>
                )}
                <p className="font-mono text-[11px] text-muted-foreground">{meta}</p>
            </div>
            {action}
        </li>
    )
}

function RowButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        >
            {children}
        </Button>
    )
}
