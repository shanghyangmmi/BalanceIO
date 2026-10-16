import { Bill, Vendor } from "../types/purchases";

export const defaultVendors: Vendor[] = [
    { id: "V-001", name: "PT Telkom Indonesia", email: "billing@telkom.co.id", address: "Jakarta", taxId: "01.000.000.0-000.000" },
    { id: "V-002", name: "CV Jasa Bersih", email: "admin@jasabersih.com", address: "Bandung" },
    { id: "V-003", name: "Toko Elektronik Makmur", email: "sales@makmur.com", phone: "021-555555" },
    { id: "CONT-999", name: "PT Serba Mulia (Hybrid)", email: "admin@serbamulia.co.id", address: "Kawasan Industri MM2100" }
];

export const defaultBills: Bill[] = [
    {
        id: "BILL-2024-001",
        vendorId: "V-001",
        vendorName: "PT Telkom Indonesia",
        date: new Date("2024-01-05"),
        dueDate: new Date("2024-01-20"),
        referenceNumber: "INV-TEL-JAN",
        status: "PAID",
        items: [
            { id: "BI-1", description: "Internet Service Jan 2024", accountId: "6-1300", quantity: 1, unitPrice: 1500000, amount: 1500000 }
        ],
        subtotal: 1500000,
        taxTotal: 165000,
        total: 1665000
    },
    {
        id: "BILL-2024-002",
        vendorId: "V-003",
        vendorName: "Toko Elektronik Makmur",
        date: new Date("2024-01-10"),
        dueDate: new Date("2024-02-10"),
        referenceNumber: "INV-999",
        status: "OPEN",
        items: [
            { id: "BI-2", description: "Office Laptop Purchase", accountId: "1-2104", quantity: 2, unitPrice: 15000000, amount: 30000000 }
        ],
        subtotal: 30000000,
        taxTotal: 3300000,
        total: 33300000
    },
    {
        id: "BILL-2024-003",
        vendorId: "CONT-999",
        vendorName: "PT Serba Mulia (Hybrid)",
        date: new Date("2024-02-05"),
        dueDate: new Date("2024-02-25"),
        referenceNumber: "INV-SERBA-001",
        status: "OPEN",
        items: [
            { id: "BI-3", description: "Server Rack Hosting", accountId: "6-2000", quantity: 1, unitPrice: 5000000, amount: 5000000 }
        ],
        subtotal: 5000000,
        taxTotal: 550000,
        total: 5550000
    }
];
