// Invoice data type for templates
export interface InvoiceData {
    // Header
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

    // Company Info
    company: {
        name: string;
        address: string;
        phone?: string;
        email?: string;
        taxId?: string;
        logo?: string;
    };

    // Customer Info
    customer: {
        name: string;
        address?: string;
        email?: string;
        phone?: string;
        taxId?: string;
    };

    // Line Items
    items: InvoiceLineItem[];

    // Totals
    subtotal: number;
    subtotalDpp?: number;
    discountPercent?: number;
    discountAmount: number;
    taxRate?: number;
    taxAmount: number;
    ppnbmAmount?: number;
    total: number;
    amountPaid: number;
    amountDue: number;

    // Additional
    currency: string;
    notes?: string;
    terms?: string;
    referenceNumber?: string;
}

export interface InvoiceLineItem {
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountPercent?: number;
    discountAmount: number;
    dppScheme?: 'NilaiLain11Over12' | 'Standard' | 'BesaranTertentu' | 'ZeroRated' | 'Exempt';
    dppAmount?: number;
    taxRate?: number;
    taxAmount: number;
    ppnbmAmount?: number;
    lineTotal: number;
}

export interface TemplateConfig {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    showLogo: boolean;
    showTaxId: boolean;
    showTerms: boolean;
    showNotes: boolean;
    showPaymentInfo: boolean;
}

// Default template configuration
export const defaultTemplateConfig: TemplateConfig = {
    primaryColor: '#0B3C3D',
    secondaryColor: '#10B981',
    fontFamily: "var(--font-document, 'Lato', 'Helvetica Neue', Arial, sans-serif)",
    showLogo: true,
    showTaxId: true,
    showTerms: true,
    showNotes: true,
    showPaymentInfo: true,
};

// Sample invoice data for previews
export const sampleInvoice: InvoiceData = {
    invoiceNumber: 'INV-2026-0001',
    invoiceDate: '2026-02-01',
    dueDate: '2026-03-01',
    status: 'sent',
    company: {
        name: 'BalanceIO Corp',
        address: 'Jl. Sudirman No. 123\nJakarta Pusat, 10110\nIndonesia',
        phone: '+62 21 1234 5678',
        email: 'billing@balanceio.com',
        taxId: '01.234.567.8-012.000',
    },
    customer: {
        name: 'PT Maju Jaya',
        address: 'Jl. Gatot Subroto No. 456\nJakarta Selatan, 12930',
        email: 'finance@majujaya.com',
        phone: '+62 21 8765 4321',
        taxId: '02.345.678.9-023.000',
    },
    items: [
        {
            lineNumber: 1,
            description: 'Professional Accounting Services - Monthly',
            quantity: 1,
            unit: 'month',
            unitPrice: 5000000,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 11,
            taxAmount: 550000,
            lineTotal: 5550000,
        },
        {
            lineNumber: 2,
            description: 'Tax Consultation',
            quantity: 3,
            unit: 'hour',
            unitPrice: 500000,
            discountPercent: 10,
            discountAmount: 150000,
            taxRate: 11,
            taxAmount: 148500,
            lineTotal: 1498500,
        },
        {
            lineNumber: 3,
            description: 'Financial Reporting Setup',
            quantity: 1,
            unit: 'project',
            unitPrice: 2500000,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 11,
            taxAmount: 275000,
            lineTotal: 2775000,
        },
    ],
    subtotal: 8850000,
    discountPercent: 0,
    discountAmount: 150000,
    taxRate: 11,
    taxAmount: 973500,
    total: 9823500,
    amountPaid: 0,
    amountDue: 9823500,
    currency: 'IDR',
    notes: 'Thank you for your business!',
    terms: 'Payment due within 30 days. Late payments subject to 2% monthly interest.',
    referenceNumber: 'PO-2026-0042',
};
