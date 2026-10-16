import { Contact, SalesInvoice } from "../types/sales";

export const defaultCustomers: Contact[] = [
    { id: "CUST-001", name: "PT Maju Sejahtera", email: "contact@majusejahtera.com", address: "Jl. Sudirman No. 1, Jakarta", taxId: "99.999.999.9-999.000", type: 'Customer' },
    { id: "CUST-002", name: "CV Berkah Abadi", email: "sales@berkahabadi.co.id", address: "Jl. Gatot Subroto No. 55, Bandung", type: 'Customer' },
    { id: "CUST-003", name: "Budi Santoso", email: "budi.s@gmail.com", phone: "081234567890", type: 'Customer' },
    { id: "CONT-999", name: "PT Serba Mulia (Hybrid)", email: "admin@serbamulia.co.id", address: "Kawasan Industri MM2100", type: 'Customer' }
];

export const defaultInvoices: SalesInvoice[] = [
    {
        id: "INV-2024-001",
        invoiceNumber: "INV-2024-001",
        contactId: "CUST-001",
        contactName: "PT Maju Sejahtera",
        invoiceDate: "2024-01-10",
        dueDate: "2024-02-10",
        status: "Paid",
        lines: [
            { id: "IT-1", description: "Consulting Services", quantity: 1, unitPrice: 15000000, lineTotal: 15000000, taxRate: 11, taxAmount: 1650000, isTaxable: true, discountPercent: 0, discountAmount: 0 }
        ],
        subtotal: 15000000,
        taxAmount: 1650000,
        total: 16650000,
        amountPaid: 16650000,
        amountDue: 0,
        billingAddress: "Jl. Sudirman No. 1, Jakarta",
        currency: "IDR",
        exchangeRate: 1,
        discountPercent: 0,
        discountAmount: 0
    },
    {
        id: "INV-2024-002",
        invoiceNumber: "INV-2024-002",
        contactId: "CUST-002",
        contactName: "CV Berkah Abadi",
        invoiceDate: "2024-01-15",
        dueDate: "2024-01-30",
        status: "Sent",
        lines: [
            { id: "IT-2", description: "Web Development", quantity: 1, unitPrice: 25000000, lineTotal: 25000000, taxRate: 11, taxAmount: 2750000, isTaxable: true, discountPercent: 0, discountAmount: 0 }
        ],
        subtotal: 25000000,
        taxAmount: 2750000,
        total: 27750000,
        amountPaid: 0,
        amountDue: 27750000,
        billingAddress: "Jl. Gatot Subroto No. 55, Bandung",
        currency: "IDR",
        exchangeRate: 1,
        discountPercent: 0,
        discountAmount: 0
    },
    {
        id: "INV-2024-003",
        invoiceNumber: "INV-2024-003",
        contactId: "CONT-999",
        contactName: "PT Serba Mulia (Hybrid)",
        invoiceDate: "2024-02-01",
        dueDate: "2024-02-15",
        status: "Sent",
        lines: [
            { id: "IT-3", description: "ERP Implementation", quantity: 1, unitPrice: 50000000, lineTotal: 50000000, taxRate: 11, taxAmount: 5500000, isTaxable: true, discountPercent: 0, discountAmount: 0 }
        ],
        subtotal: 50000000,
        taxAmount: 5500000,
        total: 55500000,
        amountPaid: 0,
        amountDue: 55500000,
        billingAddress: "Kawasan Industri MM2100",
        currency: "IDR",
        exchangeRate: 1,
        discountPercent: 0,
        discountAmount: 0
    }
];

export const defaultProducts = [
    { id: "P-001", name: "Consulting Services (Hourly)", unit: "Hour", price: 1500000 },
    { id: "P-002", name: "Web Development Package", unit: "Project", price: 25000000 },
    { id: "P-003", name: "Hosting Maintenance (Yearly)", unit: "Year", price: 2500000 },
    { id: "P-004", name: "Domain Registration", unit: "Year", price: 250000 },
];
