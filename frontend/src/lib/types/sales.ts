export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Void' | 'Overdue';

export interface SalesInvoiceLine {
    id?: string;
    salesInvoiceId?: string;
    productId?: string;
    productName?: string; // Optional, for display
    accountId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    taxRate: number;
    taxAmount: number;
    isTaxable: boolean;
    lineTotal: number;
}

export interface SalesInvoice {
    id: string;
    invoiceNumber: string;
    invoiceDate: string; // ISO Date
    dueDate: string; // ISO Date
    contactId: string;
    contactName?: string; // Optional, for display
    billingAddress: string;
    currency: string;
    exchangeRate: number;
    discountPercent: number;
    discountAmount: number;
    subtotal: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    notes?: string;
    terms?: string;
    lines: SalesInvoiceLine[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Contact {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    type: 'Customer' | 'Vendor';
}

export interface Product {
    id: string;
    name: string;
    code: string;
    sku?: string;
    description?: string;
    salePrice: number;
    purchasePrice: number;
    stockOnHand: number;
    unit: string;
    isTaxable: boolean;
    trackInventory: boolean;
}
