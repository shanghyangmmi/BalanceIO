import { Contact } from "@/components/contacts/types"

// Numeric enum values:
// type: 0=Customer, 1=Vendor, 2=Both
// category: 0=Individual, 1=Corporate, 2=Government
// scope: 0=Local, 1=Foreign

export const defaultContacts: Contact[] = [
    {
        id: "CUST-001",
        code: "C-001",
        name: "PT Maju Sejahtera",
        email: "contact@majusejahtera.com",
        address: "Jl. Sudirman No. 1, Jakarta",
        taxId: "01.234.567.8-011.000",
        type: 0, // Customer
        category: 1, // Corporate
        scope: 0, // Local
        creditLimit: 100000000,
        paymentTermDays: 30,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "CUST-002",
        code: "C-002",
        name: "CV Berkah Abadi",
        email: "sales@berkahabadi.co.id",
        address: "Jl. Gatot Subroto No. 55, Bandung",
        type: 0, // Customer
        category: 1, // Corporate
        scope: 0, // Local
        creditLimit: 50000000,
        paymentTermDays: 14,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "CUST-003",
        code: "C-003",
        name: "Budi Santoso",
        email: "budi.s@gmail.com",
        phone: "081234567890",
        type: 0, // Customer
        category: 0, // Individual
        scope: 0, // Local
        taxId: "1234567890123456",
        creditLimit: 0,
        paymentTermDays: 0,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "V-001",
        code: "V-001",
        name: "PT Telkom Indonesia",
        email: "billing@telkom.co.id",
        address: "Graha Merah Putih, Jakarta",
        taxId: "01.000.000.0-000.000",
        type: 1, // Vendor
        category: 1, // Corporate
        scope: 0, // Local
        creditLimit: 0,
        paymentTermDays: 30,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "V-002",
        code: "V-002",
        name: "CV Jasa Bersih",
        email: "admin@jasabersih.com",
        address: "Bandung Area",
        type: 1, // Vendor
        category: 1, // Corporate
        scope: 0, // Local
        creditLimit: 0,
        paymentTermDays: 14,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "V-003",
        code: "V-003",
        name: "Toko Elektronik Makmur",
        email: "sales@makmur.com",
        phone: "021-555555",
        type: 1, // Vendor
        category: 0, // Individual
        scope: 0, // Local
        creditLimit: 0,
        paymentTermDays: 14,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "CONT-999",
        code: "CV-001",
        name: "PT Serba Mulia (Hybrid)",
        email: "admin@serbamulia.co.id",
        address: "Kawasan Industri MM2100",
        type: 2, // Both
        category: 1, // Corporate
        scope: 0, // Local
        creditLimit: 100000000,
        paymentTermDays: 30,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "GOV-001",
        code: "G-001",
        name: "Kementerian Keuangan RI",
        address: "Gedung Djuanda I",
        type: 0, // Customer
        category: 2, // Government
        scope: 0, // Local
        taxId: "00.000.000.0-000.000",
        creditLimit: 0,
        paymentTermDays: 45,
        defaultCurrency: "IDR",
        isActive: true
    },
    {
        id: "INT-001",
        code: "V-INT-001",
        name: "AWS Web Services",
        email: "billing@aws.amazon.com",
        address: "Seattle, WA",
        type: 1, // Vendor
        category: 1, // Corporate
        scope: 1, // Foreign
        creditLimit: 0,
        paymentTermDays: 30,
        defaultCurrency: "USD",
        isActive: true
    }
]
