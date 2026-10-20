"use client"

import { useState, useCallback } from "react"
import { useDropzone, FileRejection } from "react-dropzone"
import { UploadCloud, X, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"


interface UploadButtonProps {
    onUpload: (files: File[]) => void
    maxSize?: number // in bytes, default 10MB
    maxFiles?: number
    accept?: Record<string, string[]>
    className?: string
}

export function UploadButton({
    onUpload,
    maxSize = 10 * 1024 * 1024, // 10MB default
    maxFiles = 5,
    accept = {
        'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
        'application/pdf': ['.pdf'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/vnd.ms-excel': ['.xls']
    },
    className
}: UploadButtonProps) {
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        // Handle Errors
        if (fileRejections.length > 0) {
            fileRejections.forEach(({ file, errors }) => {
                toast.error(`Could not upload ${file.name}`, {
                    description: errors.map(e => e.message).join(', ')
                })
            })
        }

        // Add to state
        setFiles(prev => [...prev, ...acceptedFiles])
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize,
        maxFiles,
        accept
    })

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleUpload = async () => {
        if (files.length === 0) return

        setUploading(true)
        setProgress(0)

        // Mock Upload Simulation
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval)
                    return 100
                }
                return prev + 10
            })
        }, 200)

        setTimeout(() => {
            clearInterval(interval)
            setUploading(false)
            setProgress(100)
            onUpload(files)
            setFiles([]) // Clear queue on success
            toast.success("Files uploaded successfully")
        }, 2500)
    }

    // Inline formatter if utility doesn't exist yet
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    return (
        <div className={`space-y-4 ${className}`}>
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive
                        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-cyan-400 dark:hover:border-cyan-700"
                    }
                `}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                    <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <UploadCloud className="h-8 w-8 text-zinc-500" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-medium text-sm">
                            {isDragActive ? "Drop files here" : "Click to upload or drag and drop"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Max size {formatBytes(maxSize)} per file. (PDF, IMG, Excel)
                        </p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="h-5 w-5 text-cyan-500 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                disabled={uploading}
                                className="text-zinc-500 hover:text-red-500"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {/* Progress Bar */}
                    {uploading && (
                        <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-xs">
                                <span>Uploading...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    {!uploading && (
                        <div className="pt-2 flex justify-end">
                            <Button onClick={handleUpload} size="sm">
                                Upload {files.length} File{files.length > 1 ? 's' : ''}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
