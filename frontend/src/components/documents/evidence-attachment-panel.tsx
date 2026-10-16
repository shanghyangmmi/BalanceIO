"use client";

import * as React from "react";
import { 
    Upload, FileText, Image as ImageIcon, FileSpreadsheet, Paperclip, 
    Trash2, Eye, Download, CheckCircle2, ShieldCheck, AlertCircle, 
    Loader2, Plus, ExternalLink, X
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { downloadAttachment, useAttachmentBlob } from "@/hooks/use-attachment-blob";

export interface EvidenceAttachment {
    id: string;
    companyId: string;
    entityType: string;
    entityId: string;
    attachmentType: string;
    fileName: string;
    fileExtension: string;
    contentType: string;
    fileSize: number;
    fileUrl: string;
    storagePath: string;
    notes?: string;
    uploadedBy?: string;
    uploadedAt: string;
    isVerified: boolean;
    verifiedBy?: string;
    verifiedAt?: string;
}

interface EvidenceAttachmentPanelProps {
    entityType: string;
    entityId: string;
    readOnly?: boolean;
    allowVerification?: boolean;
    onAttachmentCountChange?: (count: number) => void;
}

export function EvidenceAttachmentPanel({
    entityType,
    entityId,
    readOnly = false,
    allowVerification = false,
    onAttachmentCountChange
}: EvidenceAttachmentPanelProps) {
    const [attachments, setAttachments] = React.useState<EvidenceAttachment[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [uploadOpen, setUploadOpen] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [attachmentType, setAttachmentType] = React.useState("Receipt");
    const [notes, setNotes] = React.useState("");
    const [isUploading, setIsUploading] = React.useState(false);

    // Preview state
    const [previewAttachment, setPreviewAttachment] = React.useState<EvidenceAttachment | null>(null);

    const loadAttachments = React.useCallback(async () => {
        if (!entityId || entityId === "new") {
            setIsLoading(false);
            return;
        }
        try {
            setIsLoading(true);
            const data = await apiClient.getAttachments(entityType, entityId);
            setAttachments(data || []);
            onAttachmentCountChange?.(data?.length || 0);
        } catch (error) {
            console.error("Failed to load attachments", error);
        } finally {
            setIsLoading(false);
        }
    }, [entityType, entityId, onAttachmentCountChange]);

    React.useEffect(() => {
        loadAttachments();
    }, [loadAttachments]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error("Silakan pilih file bukti fisik (PDF, JPG, PNG, dll)");
            return;
        }

        try {
            setIsUploading(true);
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("entityType", entityType);
            formData.append("entityId", entityId);
            formData.append("attachmentType", attachmentType);
            if (notes.trim()) {
                formData.append("notes", notes.trim());
            }

            await apiClient.uploadAttachment(formData);
            toast.success("Bukti fisik berhasil dilampirkan");
            setUploadOpen(false);
            setSelectedFile(null);
            setNotes("");
            loadAttachments();
        } catch (error: any) {
            console.error("Upload error", error);
            toast.error(error.message || "Gagal mengunggah bukti fisik");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await apiClient.deleteAttachment(id);
            toast.success("Lampiran bukti berhasil dihapus");
            loadAttachments();
        } catch (error: any) {
            console.error("Delete attachment error", error);
            toast.error(error.message || "Gagal menghapus lampiran");
        }
    };

    const handleVerify = async (id: string) => {
        try {
            await apiClient.verifyAttachment(id);
            toast.success("Bukti dokumen telah diverifikasi oleh verifikator");
            loadAttachments();
        } catch (error: any) {
            console.error("Verify attachment error", error);
            toast.error(error.message || "Gagal memverifikasi dokumen");
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getBadgeInfo = (type: string) => {
        switch (type.toLowerCase()) {
            case "receipt":
            case "kuitansi":
                return { label: "Kuitansi / Bukti Bayar", variant: "default" as const, color: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200" };
            case "vendorinvoice":
            case "faktur":
                return { label: "Faktur Vendor", variant: "secondary" as const, color: "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200" };
            case "contract":
            case "kontrak":
                return { label: "Kontrak / SPK", variant: "outline" as const, color: "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200" };
            case "taxslip":
            case "buktipotong":
                return { label: "Bukti Potong Pajak", variant: "outline" as const, color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200" };
            case "bankslip":
                return { label: "Bukti Transfer Bank", variant: "outline" as const, color: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200" };
            default:
                return { label: "Dokumen Pendukung", variant: "outline" as const, color: "text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border-zinc-200" };
        }
    };

    const isPreviewable = (ext: string) => {
        const clean = ext.toLowerCase().replace(".", "");
        return ["pdf", "jpg", "jpeg", "png", "webp"].includes(clean);
    };

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                        Bukti Fisik & Dokumen Pendukung ({attachments.length})
                    </h4>
                </div>

                {!readOnly && (
                    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1">
                                <Plus className="h-3 w-3" /> Lampirkan Bukti
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="font-display">Lampirkan Bukti Fisik Transaksi</DialogTitle>
                                <DialogDescription>
                                    Unggah kuitansi, faktur tagihan vendor, kontrak SPK, atau bukti transfer bank sebagai bukti audit.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="grid gap-1.5">
                                    <Label className="text-xs font-semibold">Pilih File (Maks. 15MB)</Label>
                                    <Input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf,.xlsx,.xls,.csv,.doc,.docx"
                                        onChange={handleFileChange}
                                        className="text-xs font-mono file:text-xs file:font-mono"
                                    />
                                    <span className="text-[10px] text-muted-foreground">Format didukung: PDF, JPG, PNG, Excel, Word</span>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-xs font-semibold">Kategori Bukti Dokumen</Label>
                                    <Select value={attachmentType} onValueChange={setAttachmentType}>
                                        <SelectTrigger className="text-xs font-mono">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Receipt" className="text-xs font-mono">Kuitansi / Bukti Pembayaran</SelectItem>
                                            <SelectItem value="VendorInvoice" className="text-xs font-mono">Faktur / Invoice Vendor Asli</SelectItem>
                                            <SelectItem value="Contract" className="text-xs font-mono">Kontrak Kerjasama / SPK / PO</SelectItem>
                                            <SelectItem value="TaxSlip" className="text-xs font-mono">Bukti Potong Pajak (e-Bupot / Faktur Pajak)</SelectItem>
                                            <SelectItem value="BankSlip" className="text-xs font-mono">Bukti Transfer / Rekening Koran</SelectItem>
                                            <SelectItem value="SupportingDoc" className="text-xs font-mono">Dokumen Pendukung Lainnya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label className="text-xs font-semibold">Catatan / Deskripsi Bukti</Label>
                                    <Input
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Contoh: Kuitansi pembayaran DP 50% bermaterai"
                                        className="text-xs font-sans"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setUploadOpen(false)}>Batal</Button>
                                <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                                    Unggah Bukti
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Attachments List */}
            {isLoading ? (
                <div className="flex h-16 items-center justify-center border rounded-lg bg-muted/20">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">Memuat bukti transaksi...</span>
                </div>
            ) : attachments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs font-mono text-muted-foreground bg-muted/10">
                    Belum ada bukti fisik / kuitansi yang dilampirkan.
                </div>
            ) : (
                <div className="space-y-2">
                    {attachments.map((att) => {
                        const badge = getBadgeInfo(att.attachmentType);
                        const canPreview = isPreviewable(att.fileExtension);

                        return (
                            <div 
                                key={att.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border bg-card/60 hover:bg-card transition-colors text-xs font-mono"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
                                        {att.fileExtension.includes("pdf") ? (
                                            <FileText className="h-4 w-4 text-red-600" />
                                        ) : att.fileExtension.includes("xls") || att.fileExtension.includes("csv") ? (
                                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <ImageIcon className="h-4 w-4 text-blue-600" />
                                        )}
                                    </div>

                                    <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground truncate max-w-[240px]">
                                                {att.fileName}
                                            </span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                            {att.isVerified && (
                                                <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono gap-0.5">
                                                    <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" /> Terverifikasi
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                            <span>{formatFileSize(att.fileSize)}</span>
                                            <span>·</span>
                                            <span>Oleh {att.uploadedBy || "Accountant"}</span>
                                            <span>·</span>
                                            <span>{formatDate(att.uploadedAt)}</span>
                                        </div>

                                        {att.notes && (
                                            <div className="text-[11px] font-sans text-muted-foreground italic">
                                                {att.notes}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {canPreview && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                            onClick={() => setPreviewAttachment(att)}
                                            title="Pratinjau Dokumen"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    )}

                                    {/* A plain anchor sends no Authorization
                                        header, so this returned 401 every
                                        time. The fetch carries the token and
                                        the company scope, then saves the
                                        blob. */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            downloadAttachment(att.id, att.fileName).catch((e) =>
                                                toast.error("Gagal mengunduh", {
                                                    description: e instanceof Error ? e.message : undefined,
                                                }),
                                            )
                                        }
                                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                                        title="Unduh File"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </button>

                                    {allowVerification && !att.isVerified && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleVerify(att.id)}
                                            className="h-6 text-[10px] font-mono text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1"
                                        >
                                            <ShieldCheck className="h-3 w-3" /> Verifikasi
                                        </Button>
                                    )}

                                    {!readOnly && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDelete(att.id)}
                                            title="Hapus Bukti"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Inline Preview Modal (PDF / Image) */}
            <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-4">
                    <DialogHeader className="pb-2 border-b">
                        <div className="flex items-center justify-between pr-6">
                            <div>
                                <DialogTitle className="font-display text-base">
                                    {previewAttachment?.fileName}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-mono">
                                    Kategori: {previewAttachment?.attachmentType} · Diunggah oleh {previewAttachment?.uploadedBy}
                                </DialogDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!previewAttachment) return
                                    downloadAttachment(previewAttachment.id, previewAttachment.fileName).catch(
                                        (e) =>
                                            toast.error("Gagal mengunduh", {
                                                description: e instanceof Error ? e.message : undefined,
                                            }),
                                    )
                                }}
                                className="text-xs font-mono text-primary hover:underline inline-flex items-center gap-1"
                            >
                                <Download className="h-3 w-3" /> Unduh
                            </button>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto py-2 min-h-[450px] flex items-center justify-center bg-muted/20 rounded-md">
                        <AttachmentPreview attachment={previewAttachment} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/**
 * Renders one attachment from an authorised fetch rather than from a URL
 * the browser resolves on its own.
 *
 * Split into its own component because the hook has to be called
 * unconditionally, and the modal renders whether or not anything is
 * selected.
 */
function AttachmentPreview({ attachment }: { attachment: EvidenceAttachment | null }) {
    const { url, error, loading } = useAttachmentBlob(attachment?.id);

    if (!attachment) return null;

    if (loading) {
        return (
            <p className="text-xs font-mono text-muted-foreground">Memuat dokumen…</p>
        );
    }

    if (error || !url) {
        return (
            <p className="text-xs font-mono text-destructive">
                {error ?? "Dokumen tidak dapat ditampilkan."}
            </p>
        );
    }

    if (attachment.fileExtension.includes("pdf")) {
        return (
            <iframe src={url} className="w-full h-[550px] rounded border" title="PDF Preview" />
        );
    }

    return (
        <img
            src={url}
            alt={attachment.fileName}
            className="max-h-[550px] max-w-full object-contain rounded"
        />
    );
}
