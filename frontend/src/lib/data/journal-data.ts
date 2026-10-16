import { JournalEntry } from "@/lib/types/accounting";

export const defaultJournals: JournalEntry[] = [
    {
        id: "JE-001",
        date: new Date("2024-01-01"),
        referenceNumber: "INV-001",
        description: "Initial Capital Injection",
        status: "POSTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
            { id: "L1", accountId: "1-1101", description: "Cash Deposit", debit: 50000000, credit: 0 },
            { id: "L2", accountId: "3-1000", description: "Owner Capital", debit: 0, credit: 50000000 },
        ]
    },
    {
        id: "JE-002",
        date: new Date("2024-01-05"),
        referenceNumber: "BILL-002",
        description: "Office Rent Payment - Jan",
        status: "POSTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
            { id: "L3", accountId: "6-1200", description: "Rent Expense", debit: 5000000, credit: 0 },
            { id: "L4", accountId: "1-1103", description: "Bank Transfer", debit: 0, credit: 5000000 },
        ]
    }
];
