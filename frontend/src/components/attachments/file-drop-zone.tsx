"use client"

import { useDropzone, type FileRejection } from "react-dropzone"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function formatBytes(bytes: number) {
    const oneDecimal = (n: number) => n.toFixed(1).replace(/\.0$/, "")
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${oneDecimal(bytes / 1024)} KB`
    return `${oneDecimal(bytes / (1024 * 1024))} MB`
}

const extensionOf = (name: string) => {
    const dot = name.lastIndexOf(".")
    return dot < 0 ? "" : name.slice(dot).toLowerCase()
}

const FORMAT_LABELS: Record<string, string> = {
    ".pdf": "PDF", ".jpg": "JPG", ".jpeg": "JPG", ".png": "PNG",
    ".xlsx": "Excel", ".xls": "Excel", ".doc": "Word", ".docx": "Word", ".csv": "CSV",
}

const formatList = (extensions: string[]) =>
    [...new Set(extensions.map(e => FORMAT_LABELS[e] ?? e.replace(".", "").toUpperCase()))].join(", ")

interface FileDropZoneProps {
    /** Called with the files that pass the checks below; nothing is uploaded here. */
    onFiles: (files: File[]) => void
    /** Lower-case, with the dot, as the server lists them. */
    extensions: string[]
    maxBytes: number
    disabled?: boolean
    /** A single line, for when files are already listed beneath. */
    compact?: boolean
    className?: string
}

/**
 * Picks files for the caller to keep. The checks mirror what the server
 * will accept, so a file is refused here, with its reason, rather than
 * after the form it belongs to has been saved.
 */
export function FileDropZone({ onFiles, extensions, maxBytes, disabled, compact, className }: FileDropZoneProps) {
    const onDrop = (accepted: File[], rejected: FileRejection[]) => {
        for (const { file, errors } of rejected) {
            toast.error(`${file.name} was not added`, { description: errors.map(e => e.message).join(" ") })
        }
        if (accepted.length > 0) onFiles(accepted)
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled,
        validator: (file) => {
            // While dragging, the browser offers items without names.
            if (typeof file.name !== "string") return null
            if (!extensions.includes(extensionOf(file.name))) {
                return { code: "file-invalid-type", message: `Accepted formats: ${formatList(extensions)}.` }
            }
            if (file.size > maxBytes) {
                return { code: "file-too-large", message: `Larger than ${formatBytes(maxBytes)}.` }
            }
            return null
        },
    })

    return (
        <div
            {...getRootProps()}
            className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-foreground/15 text-center transition-colors outline-none hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                compact ? "h-10 gap-2" : "min-h-32 flex-col gap-1.5 p-4",
                isDragActive && "border-foreground/40 bg-foreground/[0.03]",
                disabled && "pointer-events-none opacity-50",
                className,
            )}
        >
            <input {...getInputProps({ accept: extensions.join(",") })} />
            <Upload className="h-4 w-4 text-muted-foreground" />
            <p className={cn("text-foreground", compact ? "text-xs" : "text-sm")}>
                {isDragActive ? "Drop to add" : <>Drop files or <span className="underline underline-offset-4">browse</span></>}
            </p>
            {!compact && (
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {formatList(extensions)} · up to {formatBytes(maxBytes)}
                </p>
            )}
        </div>
    )
}
