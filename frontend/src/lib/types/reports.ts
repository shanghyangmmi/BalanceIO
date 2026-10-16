export interface ReportItem {
    code: string;
    name: string;
    balance: number;
}

export interface Section {
    name?: string;
    accounts: ReportItem[];
    total: number;
}

export interface BalanceGroup {
    name?: string;
    current: Section;
    nonCurrent: Section;
    total: number;
}

export interface BalanceSheetResponse {
    assets: BalanceGroup;
    liabilities: BalanceGroup;
    equity: Section;
}

export interface ProfitLossResponse {
    revenue: Section;
    cogs: Section;
    expenses: Section;
    grossProfit: number;
    netIncome: number;
}

export interface AgedReportRow {
    contactId: string;
    contactName: string;
    current: number;
    over30: number;
    over60: number;
    over90: number;
    over90Plus: number;
    total: number;
}

export interface AgedReportResponse {
    rows: AgedReportRow[];
    totalCurrent: number;
    total30: number;
    total60: number;
    total90: number;
    total90Plus: number;
    grandTotal: number;
}

export interface InventoryReportItem {
    productId: string;
    code: string;
    name: string;
    quantity: number;
    averageCost: number;
    totalValue: number;
}

export interface InventoryValuationResponse {
    items: InventoryReportItem[];
    totalValue: number;
    totalItems: number;
}

export interface CashFlowResponse {
    operatingActivities: ReportItem[];
    investingActivities: ReportItem[];
    financingActivities: ReportItem[];
    netCashChange: number;
    cashAtBeginning: number;
    cashAtEnd: number;
}

export interface EquityChangeResponse {
    startDate: string;
    endDate: string;
    openingEquity: number;
    netIncome: number;
    capitalInjection: number;
    dividends: number;
    closingEquity: number;
}

export interface TrialBalanceItem {
    code: string;
    name: string;
    debit: number;
    credit: number;
}

export interface TrialBalanceResponse {
    items: TrialBalanceItem[];
    totalDebit: number;
    totalCredit: number;
}

export interface GeneralLedgerLine {
    date: string;
    reference?: string;
    description?: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface GeneralLedgerResponse {
    startDate: string;
    endDate: string;
    accountCode?: string;
    accountName?: string;
    openingBalance?: number;
    lines: GeneralLedgerLine[];
}

export interface AssetsScheduleItem {
    assetId: string;
    name: string;
    code: string;
    category: string;
    acquisitionDate: string;
    cost: number;
    method: string;
    accumulatedDepreciation: number;
    bookValue: number;
}

export interface AssetsScheduleResponse {
    items: AssetsScheduleItem[];
    totalCost: number;
    totalAccumulatedDepreciation: number;
    totalBookValue: number;
}
