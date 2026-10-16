export type ContactCategory = "Individual" | "Corporate" | "Government"
export type ContactScope = "Local" | "Foreign"
// Backend enum: Customer=0, Vendor=1, Both=2
export type ContactType = "Customer" | "Vendor" | "Both"

export interface Contact {
    id: string
    code: string
    name: string
    displayName?: string
    type: number // 0=Customer, 1=Vendor, 2=Both
    category: number // 0=Individual, 1=Corporate, 2=Government
    scope: number // 0=Local, 1=Foreign
    email?: string
    phone?: string
    mobile?: string
    address?: string
    city?: string
    postalCode?: string
    country?: string
    taxId?: string
    taxName?: string
    creditLimit: number
    paymentTermDays: number
    defaultCurrency: string
    defaultReceivableAccountId?: string
    defaultPayableAccountId?: string
    isActive: boolean

    // Additive Contact Roles (Blueprint Roadmap Item 2)
    isCustomer?: boolean
    isVendor?: boolean
    isEmployee?: boolean
    isTaxParty?: boolean

    // Employee Attributes (Unblocks Payroll & PPh 21)
    nik?: string
    ptkpStatus?: string
    bpjsKetenagakerjaanNumber?: string
    bpjsKesehatanNumber?: string
    bankName?: string
    bankAccountNumber?: string
    bankAccountHolder?: string

    // Vendor / Withholding Profile Attributes (Unblocks PPh 23 / 4(2) Reconciliations)
    withholdingType?: string
    withholdingRate?: number
    hasWithholdingExemption?: boolean
    exemptionExpiryDate?: string

    // Tax Party Attributes
    isPkp?: boolean
    pkpDate?: string

    createdAt?: string
    updatedAt?: string
}

// Helper maps for display
export const contactTypeLabels: Record<number, string> = {
    0: "Customer",
    1: "Vendor",
    2: "Both"
}

export const contactCategoryLabels: Record<number, string> = {
    0: "Individual",
    1: "Corporate",
    2: "Government"
}

export const contactScopeLabels: Record<number, string> = {
    0: "Local",
    1: "Foreign"
}

export const ptkpStatusOptions = [
    "TK/0", "TK/1", "TK/2", "TK/3",
    "K/0", "K/1", "K/2", "K/3"
]

export const withholdingTypeOptions = [
    "None",
    "PPh 23 (2% - Jasa)",
    "PPh 4(2) Final (10% - Sewa Bangunan)",
    "PPh 21 Non-Pegawai (2.5% - 5%)",
    "PPh 22 (1.5% - Pembelian)"
]
