// Generic Document Types for all financial documents

export type DocumentType =
    // Sales
    | 'sales-invoice'
    | 'sales-order'
    | 'delivery-order'
    | 'receipt-voucher'
    | 'credit-note'
    // Purchases
    | 'purchase-order'
    | 'goods-receipt'
    | 'purchase-bill'
    | 'payment-voucher'
    | 'debit-note'
    // Banking
    | 'bank-receipt'
    | 'bank-payment'
    | 'cash-receipt'
    | 'cash-payment'
    | 'fund-transfer'
    // Adjustments
    | 'journal-voucher'
    | 'opening-balance'
    | 'contra-entry';

export interface DocumentParty {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
}

export interface DocumentLineItem {
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountPercent?: number;
    discountAmount: number;
    taxRate?: number;
    taxAmount: number;
    lineTotal: number;
    // For inventory
    itemCode?: string;
    warehouseFrom?: string;
    warehouseTo?: string;
}

export interface JournalEntry {
    lineNumber: number;
    accountCode: string;
    accountName: string;
    description?: string;
    debit: number;
    credit: number;
}

export interface DocumentData {
    // Document Identity
    documentType: DocumentType;
    documentNumber: string;
    documentDate: string;
    referenceNumber?: string;
    status: 'draft' | 'pending' | 'approved' | 'sent' | 'posted' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'void' | 'completed' | 'received';

    // Company (Issuer)
    company: DocumentParty & { logo?: string };

    // Counterparty (Customer/Vendor)
    counterparty: DocumentParty;
    counterpartyLabel?: string; // "Customer", "Vendor", "Supplier", etc.

    // Dates
    dueDate?: string;
    deliveryDate?: string;
    paymentDate?: string;

    // Line Items (for transactions)
    items?: DocumentLineItem[];

    // Journal Entries (for accounting docs)
    journalEntries?: JournalEntry[];

    // Totals
    subtotal?: number;
    discountPercent?: number;
    discountAmount?: number;
    taxRate?: number;
    taxAmount?: number;
    total: number;
    amountPaid?: number;
    amountDue?: number;

    // Banking
    fromAccount?: string;
    toAccount?: string;
    paymentMethod?: string;
    bankName?: string;
    accountNumber?: string;

    // Metadata
    currency: string;
    notes?: string;
    terms?: string;
    createdBy?: string;
    approvedBy?: string;
}

// Document type configurations
export const documentTypeConfig: Record<DocumentType, {
    title: string;
    titleShort: string;
    prefix: string;
    counterpartyLabel: string;
    showItems: boolean;
    showJournalEntries: boolean;
    showDueDate: boolean;
    showDeliveryDate: boolean;
    showPaymentInfo: boolean;
    showTotals: boolean;
    color: string;
}> = {
    // Sales
    'sales-invoice': {
        title: 'Sales Invoice',
        titleShort: 'Invoice',
        prefix: 'INV',
        counterpartyLabel: 'Bill To',
        showItems: true,
        showJournalEntries: false,
        showDueDate: true,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#0B3C3D',
    },
    'sales-order': {
        title: 'Sales Order',
        titleShort: 'SO',
        prefix: 'SO',
        counterpartyLabel: 'Customer',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: true,
        showPaymentInfo: false,
        showTotals: true,
        color: '#0ea5e9',
    },
    'delivery-order': {
        title: 'Delivery Order',
        titleShort: 'DO',
        prefix: 'DO',
        counterpartyLabel: 'Ship To',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: true,
        showPaymentInfo: false,
        showTotals: false,
        color: '#8b5cf6',
    },
    'receipt-voucher': {
        title: 'Receipt Voucher',
        titleShort: 'RV',
        prefix: 'RV',
        counterpartyLabel: 'Received From',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#10b981',
    },
    'credit-note': {
        title: 'Credit Note',
        titleShort: 'CN',
        prefix: 'CN',
        counterpartyLabel: 'Customer',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: true,
        color: '#f59e0b',
    },
    // Purchases
    'purchase-order': {
        title: 'Purchase Order',
        titleShort: 'PO',
        prefix: 'PO',
        counterpartyLabel: 'Vendor',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: true,
        showPaymentInfo: false,
        showTotals: true,
        color: '#3b82f6',
    },
    'goods-receipt': {
        title: 'Goods Receipt Note',
        titleShort: 'GRN',
        prefix: 'GRN',
        counterpartyLabel: 'Received From',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: true,
        showPaymentInfo: false,
        showTotals: false,
        color: '#06b6d4',
    },
    'purchase-bill': {
        title: 'Purchase Bill',
        titleShort: 'Bill',
        prefix: 'BILL',
        counterpartyLabel: 'Vendor',
        showItems: true,
        showJournalEntries: false,
        showDueDate: true,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#ef4444',
    },
    'payment-voucher': {
        title: 'Payment Voucher',
        titleShort: 'PV',
        prefix: 'PV',
        counterpartyLabel: 'Paid To',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#dc2626',
    },
    'debit-note': {
        title: 'Debit Note',
        titleShort: 'DN',
        prefix: 'DN',
        counterpartyLabel: 'Vendor',
        showItems: true,
        showJournalEntries: false,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: true,
        color: '#ea580c',
    },
    // Banking
    'bank-receipt': {
        title: 'Bank Receipt',
        titleShort: 'BR',
        prefix: 'BR',
        counterpartyLabel: 'Received From',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#22c55e',
    },
    'bank-payment': {
        title: 'Bank Payment',
        titleShort: 'BP',
        prefix: 'BP',
        counterpartyLabel: 'Paid To',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#f43f5e',
    },
    'cash-receipt': {
        title: 'Cash Receipt',
        titleShort: 'CR',
        prefix: 'CR',
        counterpartyLabel: 'Received From',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: true,
        color: '#84cc16',
    },
    'cash-payment': {
        title: 'Cash Payment',
        titleShort: 'CP',
        prefix: 'CP',
        counterpartyLabel: 'Paid To',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: true,
        color: '#fb7185',
    },
    'fund-transfer': {
        title: 'Fund Transfer',
        titleShort: 'FT',
        prefix: 'FT',
        counterpartyLabel: 'Transfer To',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#a855f7',
    },
    // Adjustments
    'journal-voucher': {
        title: 'Journal Voucher',
        titleShort: 'JV',
        prefix: 'JV',
        counterpartyLabel: 'Reference',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: false,
        color: '#6366f1',
    },
    'opening-balance': {
        title: 'Opening Balance',
        titleShort: 'OB',
        prefix: 'OB',
        counterpartyLabel: 'Account',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: false,
        showTotals: true,
        color: '#0891b2',
    },
    'contra-entry': {
        title: 'Contra Entry',
        titleShort: 'CE',
        prefix: 'CE',
        counterpartyLabel: 'Transfer Between',
        showItems: false,
        showJournalEntries: true,
        showDueDate: false,
        showDeliveryDate: false,
        showPaymentInfo: true,
        showTotals: true,
        color: '#7c3aed',
    },
};

// Sample data for different document types
export function getSampleDocument(type: DocumentType): DocumentData {
    const config = documentTypeConfig[type];
    const baseDoc: DocumentData = {
        documentType: type,
        documentNumber: `${config.prefix}-2026-0001`,
        documentDate: '2026-02-01',
        status: 'posted',
        company: {
            name: 'BalanceIO Corp',
            address: 'Jl. Sudirman No. 123\nJakarta Pusat, 10110',
            phone: '+62 21 1234 5678',
            email: 'billing@balanceio.com',
            taxId: '01.234.567.8-012.000',
        },
        counterparty: {
            name: 'PT Maju Jaya',
            address: 'Jl. Gatot Subroto No. 456\nJakarta Selatan, 12930',
            email: 'finance@majujaya.com',
        },
        currency: 'IDR',
        total: 0,
    };

    if (config.showItems) {
        baseDoc.items = [
            {
                lineNumber: 1,
                description: 'Product/Service A',
                quantity: 2,
                unit: 'pcs',
                unitPrice: 1500000,
                discountAmount: 0,
                taxRate: 11,
                taxAmount: 330000,
                lineTotal: 3330000,
            },
            {
                lineNumber: 2,
                description: 'Product/Service B',
                quantity: 1,
                unit: 'unit',
                unitPrice: 2500000,
                discountAmount: 0,
                taxRate: 11,
                taxAmount: 275000,
                lineTotal: 2775000,
            },
        ];
        baseDoc.subtotal = 4000000;
        baseDoc.taxAmount = 605000;
        baseDoc.total = 6105000;
        baseDoc.amountDue = 6105000;
    }

    if (config.showJournalEntries) {
        baseDoc.journalEntries = [
            { lineNumber: 1, accountCode: '1101', accountName: 'Cash', debit: 5000000, credit: 0 },
            { lineNumber: 2, accountCode: '4101', accountName: 'Sales Revenue', debit: 0, credit: 5000000 },
        ];
        baseDoc.total = 5000000;
    }

    if (config.showDueDate) {
        baseDoc.dueDate = '2026-03-01';
    }

    if (config.showDeliveryDate) {
        baseDoc.deliveryDate = '2026-02-05';
    }

    if (config.showPaymentInfo) {
        baseDoc.bankName = 'Bank BCA';
        baseDoc.accountNumber = '123-456-7890';
        baseDoc.paymentMethod = 'Bank Transfer';
    }

    return baseDoc;
}
