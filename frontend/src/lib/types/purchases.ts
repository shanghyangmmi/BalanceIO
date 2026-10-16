export interface Vendor {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    taxId?: string; // NPWP
}

export interface BillItem {
    id: string;
    description: string;
    accountId: string; // Expense or Asset account
    quantity: number;
    unitPrice: number;
    amount: number;
}

export interface Bill {
    id: string;
    vendorId: string;
    vendorName: string;
    date: Date;
    dueDate: Date;
    referenceNumber: string; // Vendor's invoice #
    status: 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE';
    items: BillItem[];
    subtotal: number;
    taxTotal: number;
    total: number;
}
