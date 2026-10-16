export interface Expense {
    id: string;
    referenceNumber: string;
    date: string;
    description: string;
    accounts: { code: string; name: string }[];
    amount: number;
    status: number; // 0=Draft, 1=Posted
}

export interface QuickExpenseDto {
    date: string;
    description: string;
    amount: number;
    expenseAccountCode: string;
    paymentAccountCode: string;
}
