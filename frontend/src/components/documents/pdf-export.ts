"use client";

export interface PdfExportOptions {
    filename?: string;
    format?: 'a4' | 'letter';
    orientation?: 'portrait' | 'landscape';
    margin?: number | [number, number, number, number];
    quality?: number; // Image quality 0-1
}

const defaultOptions: PdfExportOptions = {
    filename: 'document.pdf',
    format: 'a4',
    orientation: 'portrait',
    margin: 10,
    quality: 0.98,
};

/**
 * Export a DOM element to PDF using html2pdf.js
 * @param element - The HTML element to export
 * @param options - PDF export options
 */
export async function exportToPdf(
    element: HTMLElement,
    options: PdfExportOptions = {}
): Promise<void> {
    // Dynamic import to avoid SSR issues
    const html2pdf = (await import('html2pdf.js')).default;
    const opts = { ...defaultOptions, ...options };

    const pdfOptions = {
        margin: opts.margin,
        filename: opts.filename,
        image: { type: 'jpeg' as const, quality: opts.quality },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
        },
        jsPDF: {
            unit: 'mm',
            format: opts.format,
            orientation: opts.orientation,
        },
    };

    try {
        await html2pdf().set(pdfOptions).from(element).save();
    } catch (error) {
        console.error('PDF export failed:', error);
        throw error;
    }
}

/**
 * Export a DOM element to PDF and return as Blob
 */
export async function exportToPdfBlob(
    element: HTMLElement,
    options: PdfExportOptions = {}
): Promise<Blob> {
    // Dynamic import to avoid SSR issues
    const html2pdf = (await import('html2pdf.js')).default;
    const opts = { ...defaultOptions, ...options };

    const pdfOptions = {
        margin: opts.margin,
        filename: opts.filename,
        image: { type: 'jpeg' as const, quality: opts.quality },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
        },
        jsPDF: {
            unit: 'mm',
            format: opts.format,
            orientation: opts.orientation,
        },
    };

    try {
        const pdf = await html2pdf().set(pdfOptions).from(element).outputPdf('blob');
        return pdf;
    } catch (error) {
        console.error('PDF export failed:', error);
        throw error;
    }
}
