import { toast } from "sonner"
import { siteConfig } from "@/config/site"
import { format } from "date-fns"

const BASE_URL = siteConfig.api.baseUrl;

/**
 * A failed API call. `code` is the server's stable machine-readable reason
 * (for example PERIOD_LOCKED or SEGREGATION_OF_DUTIES_VIOLATION) when it sent
 * one; callers branch on that, never on the message text.
 */
export class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) {
        super(message)
        this.name = "ApiError"
    }
}

export interface JournalLineInput {
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
    tax?: string;
}

/** What the API accepts for a Draft. Status, tenant and approval fields are server-owned. */
export interface JournalEntryInput {
    date: string;
    referenceNumber?: string;
    tags?: string;
    contactId?: string;
    currency?: string;
    notes?: string;
    projectId?: string | null;
    isAdjustingEntry?: boolean;
    lines: JournalLineInput[];
}

/** `silent` leaves error reporting to the caller instead of toasting. */
type ApiOptions = RequestInit & { silent?: boolean }

type ApiResponse<T> = {
    data: T
    status: number
    message?: string
}

async function request<T>(endpoint: string, apiOptions: ApiOptions = {}, tokenKey: string = "token"): Promise<T> {
    const { silent, ...options } = apiOptions
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`

    const isServer = typeof window === "undefined"
    const token = !isServer ? localStorage.getItem(tokenKey) : null

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers as Record<string, string>,
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }

    if (!isServer && tokenKey === "token") {
        const companyId = localStorage.getItem("selectedCompanyId");
        if (companyId) {
            headers["X-Company-Id"] = companyId;
        }
    }

    // Attach automatic Idempotency Key header for mutation operations to prevent duplicate execution
    const method = (options.method || "GET").toUpperCase();
    if (method === "POST" || method === "PUT" || method === "DELETE") {
        if (!headers["X-Idempotency-Key"] && typeof crypto !== "undefined" && crypto.randomUUID) {
            headers["X-Idempotency-Key"] = crypto.randomUUID();
        }
    }

    try {
        const response = await fetch(url, { ...options, headers, credentials: "include" })

        // Handle 503 Service Unavailable (Maintenance Mode)
        if (response.status === 503) {
            const path = !isServer ? window.location.pathname : "";
            if (!isServer && !path.startsWith("/maintenance")) {
                window.location.href = "/maintenance";
            }
            throw new Error("System under maintenance");
        }

        if (!response.ok) {
            const status = response.status;
            const codePrefix = `ERR_${status}`;

            // Handle 401 Unauthorized specifically
            if (status === 401) {
                throw new ApiError(`${codePrefix}: Session expired or unauthorized access.`, status);
            }

            // The server's reason, whatever its shape: ProblemDetails, our
            // { code, message } envelope, or a bare string.
            let errorMessage = "";
            let code: string | undefined;
            const raw = await response.text().catch(() => "");
            try {
                const errorData = JSON.parse(raw);
                code = typeof errorData?.code === "string" ? errorData.code : undefined;
                errorMessage = errorData?.error || errorData?.message || errorData?.title
                    || (typeof errorData === "string" ? errorData : "");
            } catch {
                errorMessage = raw.length > 0 && raw.length <= 300 ? raw : "";
            }

            if (!errorMessage) {
                errorMessage = status === 403
                    ? "Action forbidden. This operation is restricted to Owner or Manager roles."
                    : response.statusText || "Server response error";
            }
            throw new ApiError(`${codePrefix}: ${errorMessage}`, status, code);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return await response.json();
    } catch (error: any) {
        // Handle Network Error (Failed to fetch) specifically
        if (error.message === "Failed to fetch" || (error.name === "TypeError" && error.message.includes("fetch"))) {
            error = new Error("ERR_503: Network Error — Unable to connect to server. Please check your network connection.");
        }

        // Only log and toast on client to avoid blocking build with server-side logs/errors
        if (!isServer && !silent) {
            if (!error.message?.includes("Session expired")) {
                console.error("API Error:", error);
                toast.error(error.message || "ERR_500: Network Error");
            }
        }
        throw error;
    }
}

export const apiClient = {
    get: async <T>(url: string, options: RequestInit = {}): Promise<T> => {
        return request<T>(url, { ...options, method: "GET" }, "token")
    },

    post: async <T>(url: string, body: any, options: ApiOptions = {}): Promise<T> => {
        return request<T>(url, {
            ...options,
            method: "POST",
            body: JSON.stringify(body)
        }, "token")
    },

    put: async <T>(url: string, body: any, options: ApiOptions = {}): Promise<T> => {
        return request<T>(url, {
            ...options,
            method: "PUT",
            body: JSON.stringify(body)
        }, "token")
    },

    delete: async <T>(url: string, options: RequestInit = {}): Promise<T> => {
        return request<T>(url, { ...options, method: "DELETE" }, "token")
    },

    // --- SALES INVOICES ---
    getInvoices: async () => {
        return apiClient.get<any[]>("/SalesInvoices");
    },

    getInvoice: async (id: string) => {
        return apiClient.get<any>(`/SalesInvoices/${id}`);
    },

    createInvoice: async (data: any) => {
        return apiClient.post<any>("/SalesInvoices", data);
    },

    updateInvoice: async (id: string, data: any) => {
        return apiClient.put<any>(`/SalesInvoices/${id}`, data);
    },

    postInvoice: async (id: string) => {
        return apiClient.post<any>(`/SalesInvoices/${id}/post`, {});
    },

    voidInvoice: async (id: string) => {
        return apiClient.post<any>(`/SalesInvoices/${id}/void`, {});
    },

    deleteInvoice: async (id: string) => {
        return apiClient.delete<any>(`/SalesInvoices/${id}`);
    },

    // --- CONTACTS ---
    getContacts: async (type?: 'Customer' | 'Vendor' | 'Both') => {
        const query = type ? `?type=${type}` : '';
        return apiClient.get<any[]>(`/Contacts${query}`);
    },

    getContact: async (id: string) => {
        return apiClient.get<any>(`/Contacts/${id}`);
    },

    createContact: async (data: any) => {
        return apiClient.post<any>("/Contacts", data);
    },

    updateContact: async (id: string, data: any) => {
        return apiClient.put<any>(`/Contacts/${id}`, data);
    },

    deleteContact: async (id: string) => {
        return apiClient.delete<any>(`/Contacts/${id}`);
    },

    // --- PURCHASE BILLS ---
    getPurchaseBills: async (status?: number, contactId?: string) => {
        const params = new URLSearchParams();
        if (status !== undefined) params.append("status", status.toString());
        if (contactId) params.append("contactId", contactId);
        return apiClient.get<any[]>(`/PurchaseBills?${params.toString()}`);
    },

    getPurchaseBill: async (id: string) => {
        return apiClient.get<any>(`/PurchaseBills/${id}`);
    },

    createPurchaseBill: async (data: any) => {
        return apiClient.post<any>("/PurchaseBills", data);
    },

    updatePurchaseBill: async (id: string, data: any) => {
        return apiClient.put<any>(`/PurchaseBills/${id}`, data);
    },

    postPurchaseBill: async (id: string) => {
        return apiClient.post<any>(`/PurchaseBills/${id}/post`, {});
    },

    voidPurchaseBill: async (id: string) => {
        return apiClient.post<any>(`/PurchaseBills/${id}/void`, {});
    },

    deletePurchaseBill: async (id: string) => {
        return apiClient.delete<any>(`/PurchaseBills/${id}`);
    },

    // --- RECEIPT VOUCHERS (Customer Payments / AR Settlement) ---
    getReceiptVouchers: async (status?: number, contactId?: string) => {
        const params = new URLSearchParams();
        if (status !== undefined) params.append("status", status.toString());
        if (contactId) params.append("contactId", contactId);
        return apiClient.get<any[]>(`/ReceiptVouchers?${params.toString()}`);
    },

    getReceiptVoucher: async (id: string) => {
        return apiClient.get<any>(`/ReceiptVouchers/${id}`);
    },

    createReceiptVoucher: async (data: any) => {
        return apiClient.post<any>("/ReceiptVouchers", data);
    },

    postReceiptVoucher: async (id: string) => {
        return apiClient.post<any>(`/ReceiptVouchers/${id}/post`, {});
    },

    voidReceiptVoucher: async (id: string) => {
        return apiClient.post<any>(`/ReceiptVouchers/${id}/void`, {});
    },

    // --- PAYMENT VOUCHERS (Vendor Payments / AP Settlement) ---
    getPaymentVouchers: async (status?: number, contactId?: string) => {
        const params = new URLSearchParams();
        if (status !== undefined) params.append("status", status.toString());
        if (contactId) params.append("contactId", contactId);
        return apiClient.get<any[]>(`/PaymentVouchers?${params.toString()}`);
    },

    getPaymentVoucher: async (id: string) => {
        return apiClient.get<any>(`/PaymentVouchers/${id}`);
    },

    createPaymentVoucher: async (data: any) => {
        return apiClient.post<any>("/PaymentVouchers", data);
    },

    postPaymentVoucher: async (id: string) => {
        return apiClient.post<any>(`/PaymentVouchers/${id}/post`, {});
    },

    voidPaymentVoucher: async (id: string) => {
        return apiClient.post<any>(`/PaymentVouchers/${id}/void`, {});
    },

    // --- JOURNAL ENTRIES ---
    getJournalEntries: async () => {
        return apiClient.get<any[]>("/JournalEntries");
    },

    // Server-side pagination (Zero Lag for 10,000+ entries).
    // Returns { items, total, page, pageSize }.
    getJournalEntriesPaged: async (page: number, pageSize: number = 50, search?: string, status?: number) => {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (search) params.append("search", search);
        if (status !== undefined) params.append("status", String(status));
        return apiClient.get<{ items: any[]; total: number; page: number; pageSize: number }>(
            `/JournalEntries?${params.toString()}`
        );
    },

    // Ledger correction workflow (Posted entries are immutable)
    voidJournalEntry: async (id: string) => {
        return apiClient.post<any>(`/JournalEntries/${id}/void`, {});
    },

    reverseJournalEntry: async (id: string, date?: string) => {
        const query = date ? `?date=${date}` : "";
        return apiClient.post<any>(`/JournalEntries/${id}/reverse${query}`, {});
    },

    getJournalEntry: async (id: string) => {
        return apiClient.get<any>(`/JournalEntries/${id}`);
    },

    // One idempotency key per submission, supplied by the caller: a retry of
    // the same submission must carry the same key to be de-duplicated.
    createJournalEntry: async (data: JournalEntryInput, idempotencyKey?: string, options: ApiOptions = {}) => {
        return apiClient.post<any>("/JournalEntries", data, {
            ...options,
            headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : undefined,
        });
    },

    postJournalEntry: async (id: string, options: ApiOptions = {}) => {
        return apiClient.post<any>(`/JournalEntries/${id}/post`, {}, options);
    },

    updateJournalEntry: async (id: string, data: JournalEntryInput, options: ApiOptions = {}) => {
        return apiClient.put<any>(`/JournalEntries/${id}`, data, options);
    },

    deleteJournalEntry: async (id: string) => {
        return apiClient.delete<any>(`/JournalEntries/${id}`);
    },

    batchPostJournalEntries: async (ids: string[]) => {
        return apiClient.post<any>("/JournalEntries/batch-post", ids);
    },

    // --- PROJECTS ---
    getProjects: async () => {
        return apiClient.get<import("./types/projects").Project[]>("/Projects");
    },

    createProject: async (data: any) => {
        return apiClient.post<import("./types/projects").Project>("/Projects", data);
    },

    updateProject: async (id: string, data: any) => {
        return apiClient.put<any>(`/Projects/${id}`, data);
    },

    deleteProject: async (id: string) => {
        return apiClient.delete<any>(`/Projects/${id}`);
    },

    // --- ACCOUNTS ---
    getAccounts: async () => {
        return apiClient.get<any[]>("/Accounts");
    },

    // --- PRODUCTS ---
    getProducts: async () => {
        return apiClient.get<any[]>("/Products");
    },

    getProduct: async (id: string) => {
        return apiClient.get<any>(`/Products/${id}`);
    },

    createProduct: async (data: any) => {
        return apiClient.post<any>("/Products", data);
    },

    updateProduct: async (id: string, data: any) => {
        return apiClient.put<any>(`/Products/${id}`, data);
    },

    deleteProduct: async (id: string) => {
        return apiClient.delete<any>(`/Products/${id}`);
    },

    adjustStock: async (id: string, data: { quantity: number; reason: string }) => {
        return apiClient.post<any>(`/Products/${id}/adjust-stock`, data);
    },

    // --- EXPENSES ---
    getExpenses: async (startDate?: Date, endDate?: Date) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'));
        return apiClient.get<any[]>(`/Expenses?${params.toString()}`);
    },

    createExpense: async (data: any) => {
        return apiClient.post<any>("/Expenses", data);
    },

    // --- REPORTS ---
    getReportsBalanceSheet: async (date?: Date, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const query = new URLSearchParams();
        if (date) query.append("asOf", format(date, 'yyyy-MM-dd'));
        if (projectId) query.append("projectId", projectId);
        if (excludeAdjusting !== undefined) query.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) query.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").BalanceSheetResponse>(`/Reports/balance-sheet?${query.toString()}`);
    },

    getReportsProfitLoss: async (startDate?: Date, endDate?: Date, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'));
        if (projectId) params.append("projectId", projectId);
        if (excludeAdjusting !== undefined) params.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) params.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").ProfitLossResponse>(`/Reports/profit-loss?${params.toString()}`);
    },

    getReportsAgedReceivables: async () => {
        return apiClient.get<import("./types/reports").AgedReportResponse>(`/Reports/aged-receivables`);
    },

    getReportsAgedPayables: async () => {
        return apiClient.get<import("./types/reports").AgedReportResponse>(`/Reports/aged-payables`);
    },

    getReportsInventory: async () => {
        return apiClient.get<import("./types/reports").InventoryValuationResponse>(`/Reports/inventory-valuation`);
    },

    getReportsTrialBalance: async (date?: Date, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const query = new URLSearchParams();
        if (date) query.append("asOf", format(date, 'yyyy-MM-dd'));
        if (projectId) query.append("projectId", projectId);
        if (excludeAdjusting !== undefined) query.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) query.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").TrialBalanceResponse>(`/Reports/trial-balance?${query.toString()}`);
    },

    getReportsGeneralLedger: async (startDate?: Date, endDate?: Date, accountId?: string, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'));
        if (accountId) params.append("accountId", accountId);
        if (projectId) params.append("projectId", projectId);
        if (excludeAdjusting !== undefined) params.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) params.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").GeneralLedgerResponse>(`/Reports/general-ledger?${params.toString()}`);
    },

    getReportsCashFlow: async (startDate?: Date, endDate?: Date, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'));
        if (projectId) params.append("projectId", projectId);
        if (excludeAdjusting !== undefined) params.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) params.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").CashFlowResponse>(`/Reports/cash-flow?${params.toString()}`);
    },

    getReportsEquity: async (startDate?: Date, endDate?: Date, projectId?: string, excludeAdjusting?: boolean, onlyAdjusting?: boolean) => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", format(startDate, 'yyyy-MM-dd'));
        if (endDate) params.append("endDate", format(endDate, 'yyyy-MM-dd'));
        if (projectId) params.append("projectId", projectId);
        if (excludeAdjusting !== undefined) params.append("excludeAdjusting", excludeAdjusting.toString());
        if (onlyAdjusting !== undefined) params.append("onlyAdjusting", onlyAdjusting.toString());
        return apiClient.get<import("./types/reports").EquityChangeResponse>(`/Reports/equity?${params.toString()}`);
    },

    getDiagnostics: async () => {
        return apiClient.get<any>("/Diagnostics/run");
    },

    // --- AUDIT LOGS ---
    getAuditLogs: async (page: number, pageSize: number = 20) => {
        return apiClient.get<any>(`/audit-logs?page=${page}&pageSize=${pageSize}`);
    },
    // --- FILES ---
    uploadFile: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        // We need to use a custom fetch here because Content-Type header needs to be unset (to let browser set boundary)
        // or we handle it in request wrapper. 
        // Our request wrapper sets Content-Type: application/json by default.
        // Let's use a special overload or just direct fetch for upload inside here, 
        // OR modify request to accept body as FormData.
        // Since request sets Content-Type to application/json, we need to override it.
        // Actually, preventing default Content-Type is tricky if we pass headers object.
        // Let's implement a specific upload method or use direct fetch.

        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(`${BASE_URL}/Files/upload`, {
            method: "POST",
            headers,
            body: formData
        });

        if (!response.ok) {
            throw new Error("File upload failed");
        }

        return await response.json();
    },

    getFiles: async () => {
        return apiClient.get<any[]>("/Files");
    },

    deleteFile: async (id: string) => {
        return apiClient.delete<any>(`/Files/${id}`);
    },

    // --- DASHBOARD ANALYTICS ---
    getExpenseBreakdown: async () => {
        return apiClient.get<any[]>("/Dashboard/expense-breakdown");
    },

    getTopProducts: async () => {
        return apiClient.get<any[]>("/Dashboard/top-products");
    },

    getSalesTrend: async () => {
        return apiClient.get<any[]>("/Dashboard/sales-trend");
    },

    // --- INVENTORY MANAGEMENT ---
    getProductCategories: async () => {
        return apiClient.get<any[]>("/ProductCategories");
    },

    createProductCategory: async (data: any) => {
        return apiClient.post<any>("/ProductCategories", data);
    },

    updateProductCategory: async (id: string, data: any) => {
        return apiClient.put<any>(`/ProductCategories/${id}`, data);
    },

    deleteProductCategory: async (id: string) => {
        return apiClient.delete<any>(`/ProductCategories/${id}`);
    },

    getProductUnits: async () => {
        return apiClient.get<any[]>("/ProductUnits");
    },

    createProductUnit: async (data: any) => {
        return apiClient.post<any>("/ProductUnits", data);
    },

    updateProductUnit: async (id: string, data: any) => {
        return apiClient.put<any>(`/ProductUnits/${id}`, data);
    },

    deleteProductUnit: async (id: string) => {
        return apiClient.delete<any>(`/ProductUnits/${id}`);
    },

    getStockOpnames: async () => {
        return apiClient.get<any[]>("/StockOpname");
    },

    getStockOpname: async (id: string) => {
        return apiClient.get<any>(`/StockOpname/${id}`);
    },

    createStockOpname: async (data: any) => {
        return apiClient.post<any>("/StockOpname", data);
    },

    initializeStockOpname: async (id: string) => {
        return apiClient.post<any>(`/StockOpname/${id}/initialize`, {});
    },

    updateStockOpname: async (id: string, data: any) => {
        return apiClient.put<any>(`/StockOpname/${id}`, data);
    },

    processStockOpname: async (id: string) => {
        return apiClient.post<any>(`/StockOpname/${id}/process`, {});
    },

    // --- SETTINGS (Email & Backup) ---
    getEmailSettings: async () => {
        return apiClient.get<any>("/EmailSettings");
    },

    saveEmailSettings: async (data: any) => {
        return apiClient.post<any>("/EmailSettings", data);
    },

    testEmailConnection: async (data: any) => {
        return apiClient.post<any>("/EmailSettings/test", data);
    },

    downloadBackup: async () => {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(`${BASE_URL}/Backup/download`, {
            method: "GET",
            headers
        });

        if (!response.ok) throw new Error("Backup download failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    },

    // --- PURCHASE ORDERS ---
    getPurchaseOrders: async () => {
        return apiClient.get<any[]>("/PurchaseOrders");
    },

    getPurchaseOrder: async (id: string) => {
        return apiClient.get<any>(`/PurchaseOrders/${id}`);
    },

    createPurchaseOrder: async (data: any) => {
        return apiClient.post<any>("/PurchaseOrders", data);
    },

    updatePurchaseOrder: async (id: string, data: any) => {
        return apiClient.put<any>(`/PurchaseOrders/${id}`, data);
    },

    deletePurchaseOrder: async (id: string) => {
        return apiClient.delete<any>(`/PurchaseOrders/${id}`);
    },

    approvePurchaseOrder: async (id: string) => {
        return apiClient.post<any>(`/PurchaseOrders/${id}/approve`, {});
    },

    receivePurchaseOrder: async (id: string) => {
        return apiClient.post<any>(`/PurchaseOrders/${id}/receive`, {});
    },

    // --- FIXED ASSETS ---
    getAssetCategories: async () => {
        return apiClient.get<any[]>("/FixedAssetCategories");
    },

    createAssetCategory: async (data: any) => {
        return apiClient.post<any>("/FixedAssetCategories", data);
    },

    updateAssetCategory: async (id: string, data: any) => {
        return apiClient.put<any>(`/FixedAssetCategories/${id}`, data);
    },

    deleteAssetCategory: async (id: string) => {
        return apiClient.delete<any>(`/FixedAssetCategories/${id}`);
    },

    getAssetLocations: async () => {
        return apiClient.get<any[]>("/FixedAssetLocations");
    },

    createAssetLocation: async (data: any) => {
        return apiClient.post<any>("/FixedAssetLocations", data);
    },

    updateAssetLocation: async (id: string, data: any) => {
        return apiClient.put<any>(`/FixedAssetLocations/${id}`, data);
    },

    deleteAssetLocation: async (id: string) => {
        return apiClient.delete<any>(`/FixedAssetLocations/${id}`);
    },

    // Migration & Import Methods
    getMigrationBatches: async () => {
        return apiClient.get<any[]>("/migration/batches");
    },

    getMigrationBatchById: async (id: string) => {
        return apiClient.get<any>(`/migration/batches/${id}`);
    },

    previewMigration: async (data: any) => {
        return apiClient.post<any>("/migration/preview", data);
    },

    commitMigration: async (data: any) => {
        return apiClient.post<any>("/migration/commit", data);
    },

    rollbackMigrationBatch: async (id: string) => {
        return apiClient.post<any>(`/migration/batches/${id}/rollback`, {});
    },

    getMigrationTemplateUrl: (type: string) => {
        return `${siteConfig.api.baseUrl}/migration/templates/${type}`;
    },

    // Exchange Rates (Kurs BI, KMK, Dual Rate & PSAK 221 Retranslation)
    getExchangeRates: async (params?: { date?: string; currency?: string; rateType?: number; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.date) q.append("date", params.date);
        if (params?.currency) q.append("currency", params.currency);
        if (params?.rateType !== undefined) q.append("rateType", params.rateType.toString());
        if (params?.limit) q.append("limit", params.limit.toString());
        const queryStr = q.toString() ? `?${q.toString()}` : "";
        return apiClient.get<any[]>(`/exchangerates${queryStr}`);
    },

    getDualExchangeRate: async (date: string, currency: string) => {
        return apiClient.get<any>(`/exchangerates/dual/${date}/${currency}`);
    },

    getKmkDecrees: async () => {
        return apiClient.get<any[]>("/exchangerates/kmk-decrees");
    },

    getExchangeMiddleRate: async (date: string, currency: string) => {
        return apiClient.get<number>(`/exchangerates/middle/${date}/${currency}`);
    },

    syncExchangeBI: async (date?: string) => {
        return apiClient.post<any>(`/exchangerates/sync/bi${date ? `?date=${date}` : ""}`, {});
    },

    syncExchangeKMK: async (date?: string) => {
        return apiClient.post<any>(`/exchangerates/sync/kmk${date ? `?date=${date}` : ""}`, {});
    },

    syncAllExchangeRates: async (date?: string) => {
        return apiClient.post<any>(`/exchangerates/sync${date ? `?date=${date}` : ""}`, {});
    },

    createManualExchangeRate: async (data: any) => {
        return apiClient.post<any>("/exchangerates/manual", data);
    },

    updateExchangeRate: async (id: string, data: any) => {
        return apiClient.put<any>(`/exchangerates/${id}`, data);
    },

    deleteExchangeRate: async (id: string) => {
        return apiClient.delete<any>(`/exchangerates/${id}`);
    },

    previewPsak221Retranslation: async (data: { asOfDate: string; currency?: string }) => {
        return apiClient.post<any>("/exchangerates/retranslate/preview", data);
    },

    postPsak221Retranslation: async (data: { asOfDate: string; currency?: string; closingRate: number; notes?: string }) => {
        return apiClient.post<any>("/exchangerates/retranslate/post", data);
    },

    getExchangeCurrencies: async () => {
        return apiClient.get<any[]>("/exchangerates/currencies");
    },

    // --- STATUTORY TAX REPORTS & DJP EXPORTS ---
    getSptPpn1111: async (year?: number, month?: number) => {
        const query = new URLSearchParams();
        if (year) query.append("year", year.toString());
        if (month) query.append("month", month.toString());
        return apiClient.get<any>(`/taxreports/spt-ppn-1111?${query.toString()}`);
    },

    getWithholdingSummary: async (year?: number, month?: number, taxType?: string) => {
        const query = new URLSearchParams();
        if (year) query.append("year", year.toString());
        if (month) query.append("month", month.toString());
        if (taxType) query.append("taxType", taxType);
        return apiClient.get<any>(`/taxreports/withholding-summary?${query.toString()}`);
    },

    getEFakturPreview: async (year?: number, month?: number) => {
        const query = new URLSearchParams();
        if (year) query.append("year", year.toString());
        if (month) query.append("month", month.toString());
        return apiClient.get<any>(`/taxreports/efaktur-preview?${query.toString()}`);
    },

    getEBupotPreview: async (year?: number, month?: number, taxType: string = "pph23") => {
        const query = new URLSearchParams();
        if (year) query.append("year", year.toString());
        if (month) query.append("month", month.toString());
        query.append("taxType", taxType);
        return apiClient.get<any>(`/taxreports/ebupot-preview?${query.toString()}`);
    },

    settlePpn: async (data: { year: number; month: number; settlementDate: string; notes?: string }) => {
        return apiClient.post<any>("/taxreports/settle-ppn", data);
    },

    getNsfpRanges: async (year?: number) => {
        const query = new URLSearchParams();
        if (year) query.append("year", year.toString());
        return apiClient.get<any[]>(`/taxreports/nsfp-ranges?${query.toString()}`);
    },

    createNsfpRange: async (data: { startNumber: string; endNumber: string; year?: number; allocatedDate?: string }) => {
        return apiClient.post<any>("/taxreports/nsfp-ranges", data);
    },

    deleteNsfpRange: async (id: string) => {
        return apiClient.delete<any>(`/taxreports/nsfp-ranges/${id}`);
    },

    getCoretaxExport: async (year: number, month: number) => {
        return apiClient.get<any>(`/taxreports/coretax-export?year=${year}&month=${month}`);
    },

    // --- BANK RECONCILIATION ---
    getBankReconciliationAccounts: async () => {
        return apiClient.get<any[]>("/bankreconciliation/accounts");
    },

    getBankReconciliationWorkspace: async (accountId: string, asOfDate?: string) => {
        const query = new URLSearchParams();
        if (asOfDate) query.append("asOfDate", asOfDate);
        return apiClient.get<any>(`/bankreconciliation/workspace/${accountId}?${query.toString()}`);
    },

    importBankStatement: async (data: { accountId: string; format: number; csvContent: string; fileName?: string; initialOpeningBalance?: number }) => {
        return apiClient.post<any>("/bankreconciliation/import", data);
    },

    autoMatchBankStatement: async (data: { accountId: string; dateToleranceDays?: number; autoSplitBankFees?: boolean }) => {
        return apiClient.post<any>("/bankreconciliation/auto-match", data);
    },

    manualMatchBankStatement: async (data: { statementLineId: string; journalLineId: string }) => {
        return apiClient.post<any>("/bankreconciliation/match", data);
    },

    unmatchBankStatement: async (data: { statementLineId: string }) => {
        return apiClient.post<any>("/bankreconciliation/unmatch", data);
    },

    postBankAdjustment: async (data: { statementLineId: string; adjustmentType: string; accountCode?: string; notes?: string }) => {
        return apiClient.post<any>("/bankreconciliation/post-adjustment", data);
    },

    finalizeBankReconciliation: async (data: { accountId: string; reconciliationDate: string; notes?: string }) => {
        return apiClient.post<any>("/bankreconciliation/finalize", data);
    },

    // --- EVIDENCE ATTACHMENTS ---
    getAttachments: async (entityType: string, entityId: string) => {
        return apiClient.get<any[]>(`/attachments/${entityType}/${entityId}`);
    },

    uploadAttachment: async (formData: FormData) => {
        return apiClient.post<any>("/attachments/upload", formData);
    },

    deleteAttachment: async (id: string) => {
        return apiClient.delete<any>(`/attachments/${id}`);
    },

    verifyAttachment: async (id: string) => {
        return apiClient.post<any>(`/attachments/${id}/verify`, {});
    },

    // --- BUDGETING & VARIANCE ANALYSIS ---
    getBudgets: async (fiscalYear?: number) => {
        const query = fiscalYear ? `?fiscalYear=${fiscalYear}` : "";
        return apiClient.get<any[]>(`/budgets${query}`);
    },

    getBudgetById: async (id: string) => {
        return apiClient.get<any>(`/budgets/${id}`);
    },

    createBudget: async (data: any) => {
        return apiClient.post<any>("/budgets", data);
    },

    updateBudget: async (id: string, data: any) => {
        return apiClient.put<any>(`/budgets/${id}`, data);
    },

    approveBudget: async (id: string) => {
        return apiClient.post<any>(`/budgets/${id}/approve`, {});
    },

    deleteBudget: async (id: string) => {
        return apiClient.delete<any>(`/budgets/${id}`);
    },

    getBudgetVarianceReport: async (params?: { fiscalYear?: number; month?: number; quarter?: number; projectId?: string; budgetId?: string }) => {
        const query = new URLSearchParams();
        if (params?.fiscalYear) query.append("fiscalYear", params.fiscalYear.toString());
        if (params?.month) query.append("month", params.month.toString());
        if (params?.quarter) query.append("quarter", params.quarter.toString());
        if (params?.projectId) query.append("projectId", params.projectId);
        if (params?.budgetId) query.append("budgetId", params.budgetId);
        return apiClient.get<any>(`/budgets/variance-report?${query.toString()}`);
    },

    // --- E2E ACCOUNTING LIFECYCLE VALIDATION ---
    runE2ELifecycleValidation: async () => {
        return apiClient.post<any>("/e2evalidation/run-cycle", {});
    },

    getLatestE2ELifecycleValidation: async () => {
        return apiClient.get<any>("/e2evalidation/latest-run");
    },

    // --- PHASE 2: AUDIT HISTORY & SUPPORT TICKETING ---
    getDocumentHistory: async (documentType: string, id: string): Promise<DocumentHistoryEvent[]> => {
        return apiClient.get<DocumentHistoryEvent[]>(`/documents/${documentType}/${id}/history`);
    },

    createSupportTicket: async (data: {
        subject: string;
        description: string;
        priority: number;
        grantTemporaryAccess: boolean;
    }): Promise<SupportTicket> => {
        return apiClient.post<SupportTicket>("/support/tickets", data);
    },

    getSupportTickets: async (status?: number): Promise<SupportTicket[]> => {
        const query = status !== undefined ? `?status=${status}` : "";
        return apiClient.get<SupportTicket[]>(`/support/tickets${query}`);
    },

    getSupportTicket: async (id: string): Promise<SupportTicket> => {
        return apiClient.get<SupportTicket>(`/support/tickets/${id}`);
    },

    replySupportTicket: async (id: string, message: string): Promise<SupportTicketMessage> => {
        return apiClient.post<SupportTicketMessage>(`/support/tickets/${id}/messages`, { message });
    },

    closeSupportTicket: async (id: string): Promise<void> => {
        return apiClient.post<void>(`/support/tickets/${id}/close`, {});
    }
}

export interface DocumentHistoryEvent {
    id: string;
    companyId: string;
    documentType: string;
    documentId: string;
    action: string;
    userId?: string;
    userEmail?: string;
    reason?: string;
    rowHash: string;
    previousHash?: string;
    metadataJson?: string;
    createdAt: string;
}

export interface SupportTicket {
    id: string;
    companyId: string;
    ticketNumber: string;
    subject: string;
    description: string;
    priority: number;
    status: number;
    createdByUserId: string;
    assignedToAdminId?: string;
    grantedAccessExpiry?: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    closedAt?: string;
    messages?: SupportTicketMessage[];
}

export interface SupportTicketMessage {
    id: string;
    supportTicketId: string;
    senderUserId?: string;
    senderEmail?: string;
    isStaffReply: boolean;
    isInternalNote: boolean;
    message: string;
    createdAt: string;
}

export const adminApiClient = {
    get: async <T>(url: string, options: RequestInit = {}): Promise<T> => {
        return request<T>(url, { ...options, method: "GET" }, "adminToken")
    },

    post: async <T>(url: string, body: any, options: ApiOptions = {}): Promise<T> => {
        return request<T>(url, {
            ...options,
            method: "POST",
            body: JSON.stringify(body)
        }, "adminToken")
    },

    put: async <T>(url: string, body: any, options: ApiOptions = {}): Promise<T> => {
        return request<T>(url, {
            ...options,
            method: "PUT",
            body: JSON.stringify(body)
        }, "adminToken")
    },

    delete: async <T>(url: string, options: RequestInit = {}): Promise<T> => {
        return request<T>(url, { ...options, method: "DELETE" }, "adminToken")
    }
}
