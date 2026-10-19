/** A supporting document stored against a journal entry, bill or other record. */
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

/** `GET /attachments/storage`: whether the server can keep an upload, and what it accepts. */
export interface AttachmentStorageStatus {
    available: boolean;
    maxFileBytes: number;
    /** Lower-case, with the dot: ".pdf". */
    extensions: string[];
}
