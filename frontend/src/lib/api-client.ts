import { toast } from "sonner"
import { siteConfig } from "@/config/site"
import { format } from "date-fns"
import type { AttachmentStorageStatus, EvidenceAttachment } from "@/lib/types/attachments"

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

/*
 * Sessions. The access token lives 15 minutes (Jwt:AccessTokenMinutes on the
 * API), in the HttpOnly balanceio_token cookie and, for the claims the UI
 * reads, in localStorage. The HttpOnly refresh cookie lives 30 days. A 401
 * trades the refresh cookie for a new access token and repeats the call once.
 */

/** Calls that start or end a session: a 401 from them is the answer, not an expired token. */
const SESSION_ENDPOINT = /^\/(admin\/)?auth\/(login|refresh|logout|mfa\/verify)\b/i

let pendingRefresh: Promise<boolean> | null = null

/**
 * Renews the access token. Resolves false when the server refuses (the
 * session is over) and throws when it cannot be reached.
 *
 * One refresh at a time, across tabs too. The server rotates the refresh
 * token on every use and treats a second presentation of the old one as
 * theft, revoking every session, so two tabs refreshing at once would sign
 * the user out. A tab that waited finds a token other than the one its call
 * carried and only repeats the call.
 */
function refreshSession(tokenKey: string, sentToken: string | null): Promise<boolean> {
    pendingRefresh ??= withRefreshLock(async () => {
        if (localStorage.getItem(tokenKey) !== sentToken) return true

        const response = await fetch(`${BASE_URL}/Auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            credentials: "include",
        })
        if (response.status === 401) return false
        if (!response.ok) {
            throw new ApiError(`ERR_${response.status}: Could not renew the session.`, response.status)
        }

        const data = await response.json()
        localStorage.setItem(tokenKey, data.token)
        return true
    }).finally(() => { pendingRefresh = null })
    return pendingRefresh
}

async function withRefreshLock(task: () => Promise<boolean>): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.locks) {
        return await navigator.locks.request("balanceio-session-refresh", task)
    }
    return task()
}

/** The refresh cookie was refused, so the session is over: back to sign-in. */
function endSession(tokenKey: string) {
    localStorage.removeItem(tokenKey)
    const admin = tokenKey === "adminToken"
    const area = admin ? "/sys-control" : "/dashboard"
    const login = admin ? "/sys-control/login" : "/login"
    const path = window.location.pathname
    if (path.startsWith(area) && !path.startsWith(login)) {
        window.location.href = login
    }
}

function withSession(given: HeadersInit | undefined, tokenKey: string): Record<string, string> {
    const headers: Record<string, string> = { ...given as Record<string, string> }
    if (typeof window === "undefined") return headers

    const token = localStorage.getItem(tokenKey)
    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }

    if (tokenKey === "token") {
        const companyId = localStorage.getItem("selectedCompanyId");
        if (companyId) {
            headers["X-Company-Id"] = companyId;
        }
    }
    return headers
}

/**
 * fetch against the API with the session attached: cookies, the bearer token
 * and, for tenant calls, X-Company-Id. A 401 renews the session once and
 * repeats the call; if the renewal is refused the user is sent to sign in.
 * The response is returned as is, so callers that want a blob can use it.
 */
export async function sessionFetch(endpoint: string, init: RequestInit = {}, tokenKey: string = "token"): Promise<Response> {
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint
    const send = () => fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: withSession(init.headers, tokenKey),
        credentials: "include",
    })

    const sentToken = typeof window === "undefined" ? null : localStorage.getItem(tokenKey)
    const response = await send()
    if (response.status !== 401 || typeof window === "undefined" || SESSION_ENDPOINT.test(path)) {
        return response
    }

    if (await refreshSession(tokenKey, sentToken)) {
        return send()
    }
    endSession(tokenKey)
    return response
}

async function request<T>(endpoint: string, apiOptions: ApiOptions = {}, tokenKey: string = "token"): Promise<T> {
    const { silent, ...options } = apiOptions

    const isServer = typeof window === "undefined"

    // A multipart body needs the browser to write its own Content-Type,
    // boundary included.
    const isMultipart = typeof FormData !== "undefined" && options.body instanceof FormData
    const headers: Record<string, string> = {
        ...(isMultipart ? {} : { "Content-Type": "application/json" }),
        ...options.headers as Record<string, string>,
    }

    // Attach automatic Idempotency Key header for mutation operations to prevent duplicate execution
    const method = (options.method || "GET").toUpperCase();
    if (method === "POST" || method === "PUT" || method === "DELETE") {
        if (!headers["X-Idempotency-Key"] && typeof crypto !== "undefined" && crypto.randomUUID) {
            headers["X-Idempotency-Key"] = crypto.randomUUID();
        }
    }

    try {
        const response = await sessionFetch(endpoint, { ...options, headers }, tokenKey)

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

        // Not through request(): it sets Content-Type to JSON, and FormData
        // needs the browser to set it with the multipart boundary.
        const response = await sessionFetch("/Files/upload", {
            method: "POST",
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
        const response = await sessionFetch("/Backup/download", { method: "GET" });

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
    // Silent: the form that asks shows its own state instead of a toast.
    getAttachmentStorage: async () => {
        return request<AttachmentStorageStatus>("/attachments/storage", { method: "GET", silent: true });
    },

    getAttachments: async (entityType: string, entityId: string) => {
        return apiClient.get<EvidenceAttachment[]>(`/attachments/${entityType}/${entityId}`);
    },

    // Not apiClient.post: that JSON-encodes its body, and a FormData
    // JSON-encodes to "{}". Every upload arrived empty.
    uploadAttachment: async (formData: FormData, options: ApiOptions = {}) => {
        return request<EvidenceAttachment>("/attachments/upload", { ...options, method: "POST", body: formData });
    },

    deleteAttachment: async (id: string, options: ApiOptions = {}) => {
        return request<unknown>(`/attachments/${id}`, { ...options, method: "DELETE" });
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
    },

    // --- PHASE 6: TRADE FLOWS & COMMERCIAL OPERATIONS ---
    // Credit Notes (Sales returns / adjustments)
    getCreditNotes: async (status?: string): Promise<CreditNote[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<CreditNote[]>(`/CreditNotes${query}`);
    },
    getCreditNote: async (id: string): Promise<CreditNote> => {
        return apiClient.get<CreditNote>(`/CreditNotes/${id}`);
    },
    createCreditNote: async (data: Partial<CreditNote>): Promise<CreditNote> => {
        return apiClient.post<CreditNote>("/CreditNotes", data);
    },
    updateCreditNote: async (id: string, data: Partial<CreditNote>): Promise<CreditNote> => {
        return apiClient.put<CreditNote>(`/CreditNotes/${id}`, data);
    },
    approveCreditNote: async (id: string): Promise<CreditNote> => {
        return apiClient.post<CreditNote>(`/CreditNotes/${id}/approve`, {});
    },
    voidCreditNote: async (id: string, reason?: string): Promise<CreditNote> => {
        return apiClient.post<CreditNote>(`/CreditNotes/${id}/void`, { reason });
    },
    deleteCreditNote: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/CreditNotes/${id}`);
    },

    // Debit Notes (Purchase returns / adjustments)
    getDebitNotes: async (status?: string): Promise<DebitNote[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<DebitNote[]>(`/DebitNotes${query}`);
    },
    getDebitNote: async (id: string): Promise<DebitNote> => {
        return apiClient.get<DebitNote>(`/DebitNotes/${id}`);
    },
    createDebitNote: async (data: Partial<DebitNote>): Promise<DebitNote> => {
        return apiClient.post<DebitNote>("/DebitNotes", data);
    },
    updateDebitNote: async (id: string, data: Partial<DebitNote>): Promise<DebitNote> => {
        return apiClient.put<DebitNote>(`/DebitNotes/${id}`, data);
    },
    approveDebitNote: async (id: string): Promise<DebitNote> => {
        return apiClient.post<DebitNote>(`/DebitNotes/${id}/approve`, {});
    },
    voidDebitNote: async (id: string, reason?: string): Promise<DebitNote> => {
        return apiClient.post<DebitNote>(`/DebitNotes/${id}/void`, { reason });
    },
    deleteDebitNote: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/DebitNotes/${id}`);
    },

    // Fund Transfers (Cash & Bank inter-account transfers)
    getFundTransfers: async (status?: string): Promise<FundTransfer[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<FundTransfer[]>(`/FundTransfers${query}`);
    },
    getFundTransfer: async (id: string): Promise<FundTransfer> => {
        return apiClient.get<FundTransfer>(`/FundTransfers/${id}`);
    },
    createFundTransfer: async (data: Partial<FundTransfer>): Promise<FundTransfer> => {
        return apiClient.post<FundTransfer>("/FundTransfers", data);
    },
    updateFundTransfer: async (id: string, data: Partial<FundTransfer>): Promise<FundTransfer> => {
        return apiClient.put<FundTransfer>(`/FundTransfers/${id}`, data);
    },
    postFundTransfer: async (id: string): Promise<FundTransfer> => {
        return apiClient.post<FundTransfer>(`/FundTransfers/${id}/post`, {});
    },
    voidFundTransfer: async (id: string, reason?: string): Promise<FundTransfer> => {
        return apiClient.post<FundTransfer>(`/FundTransfers/${id}/void`, { reason });
    },
    deleteFundTransfer: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/FundTransfers/${id}`);
    },

    // Delivery Orders (Customer Shipments)
    getDeliveryOrders: async (status?: string): Promise<DeliveryOrder[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<DeliveryOrder[]>(`/DeliveryOrders${query}`);
    },
    getDeliveryOrder: async (id: string): Promise<DeliveryOrder> => {
        return apiClient.get<DeliveryOrder>(`/DeliveryOrders/${id}`);
    },
    createDeliveryOrder: async (data: Partial<DeliveryOrder>): Promise<DeliveryOrder> => {
        return apiClient.post<DeliveryOrder>("/DeliveryOrders", data);
    },
    updateDeliveryOrder: async (id: string, data: Partial<DeliveryOrder>): Promise<DeliveryOrder> => {
        return apiClient.put<DeliveryOrder>(`/DeliveryOrders/${id}`, data);
    },
    shipDeliveryOrder: async (id: string): Promise<DeliveryOrder> => {
        return apiClient.post<DeliveryOrder>(`/DeliveryOrders/${id}/ship`, {});
    },
    deliverDeliveryOrder: async (id: string): Promise<DeliveryOrder> => {
        return apiClient.post<DeliveryOrder>(`/DeliveryOrders/${id}/deliver`, {});
    },
    deleteDeliveryOrder: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/DeliveryOrders/${id}`);
    },

    // Goods Receipts (Vendor Receipts)
    getGoodsReceipts: async (status?: string): Promise<GoodsReceipt[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<GoodsReceipt[]>(`/GoodsReceipts${query}`);
    },
    getGoodsReceipt: async (id: string): Promise<GoodsReceipt> => {
        return apiClient.get<GoodsReceipt>(`/GoodsReceipts/${id}`);
    },
    createGoodsReceipt: async (data: Partial<GoodsReceipt>): Promise<GoodsReceipt> => {
        return apiClient.post<GoodsReceipt>("/GoodsReceipts", data);
    },
    updateGoodsReceipt: async (id: string, data: Partial<GoodsReceipt>): Promise<GoodsReceipt> => {
        return apiClient.put<GoodsReceipt>(`/GoodsReceipts/${id}`, data);
    },
    receiveGoodsReceipt: async (id: string): Promise<GoodsReceipt> => {
        return apiClient.post<GoodsReceipt>(`/GoodsReceipts/${id}/receive`, {});
    },
    deleteGoodsReceipt: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/GoodsReceipts/${id}`);
    },

    // Sales Orders (Customer Orders)
    getSalesOrders: async (status?: string): Promise<SalesOrder[]> => {
        const query = status ? `?status=${encodeURIComponent(status)}` : "";
        return apiClient.get<SalesOrder[]>(`/SalesOrders${query}`);
    },
    getSalesOrder: async (id: string): Promise<SalesOrder> => {
        return apiClient.get<SalesOrder>(`/SalesOrders/${id}`);
    },
    createSalesOrder: async (data: Partial<SalesOrder>): Promise<SalesOrder> => {
        return apiClient.post<SalesOrder>("/SalesOrders", data);
    },
    updateSalesOrder: async (id: string, data: Partial<SalesOrder>): Promise<SalesOrder> => {
        return apiClient.put<SalesOrder>(`/SalesOrders/${id}`, data);
    },
    approveSalesOrder: async (id: string): Promise<SalesOrder> => {
        return apiClient.post<SalesOrder>(`/SalesOrders/${id}/approve`, {});
    },
    cancelSalesOrder: async (id: string): Promise<SalesOrder> => {
        return apiClient.post<SalesOrder>(`/SalesOrders/${id}/cancel`, {});
    },
    deleteSalesOrder: async (id: string): Promise<void> => {
        return apiClient.delete<void>(`/SalesOrders/${id}`);
    },

    // --- PHASE 7: PERIOD CLOSING & MIGRATION WIZARD ---
    getPeriodClosePreview: async (fiscalYear: number): Promise<PeriodClosePreview> => {
        return apiClient.get<PeriodClosePreview>(`/accounting/period-close/preview?fiscalYear=${fiscalYear}`);
    },
    executeYearEndClose: async (data: PeriodCloseYearEndRequest): Promise<PeriodCloseYearEndResult> => {
        return apiClient.post<PeriodCloseYearEndResult>("/accounting/period-close/year-end", data);
    },
    getPeriodCloseHistory: async (): Promise<any[]> => {
        return apiClient.get<any[]>("/accounting/period-close/history");
    },
    lockPeriod: async (lockDate: string): Promise<{ lockDate: string; message: string }> => {
        return apiClient.post<{ lockDate: string; message: string }>("/accounting/period-close/lock", { lockDate });
    },
    unlockPeriod: async (): Promise<{ message: string }> => {
        return apiClient.post<{ message: string }>("/accounting/period-close/unlock", {});
    },
    getMigrationWizardStatus: async (): Promise<MigrationWizardStatus> => {
        return apiClient.get<MigrationWizardStatus>("/migration/wizard/status");
    },
    getMigrationWizardReconciliation: async (): Promise<MigrationWizardReconciliation> => {
        return apiClient.get<MigrationWizardReconciliation>("/migration/wizard/reconciliation");
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

// --- PHASE 6: TRADE FLOW INTERFACES ---

export interface CreditNoteLine {
    id?: string;
    creditNoteId?: string;
    lineNumber?: number;
    salesInvoiceLineId?: string | null;
    productId?: string | null;
    accountId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    costCenterId?: string | null;
}

export interface CreditNote {
    id: string;
    companyId: string;
    creditNoteNumber: string;
    date: string;
    contactId: string;
    salesInvoiceId?: string | null;
    warehouseId?: string | null;
    returnToInventory: boolean;
    currency: string;
    exchangeRate: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    remainingAmount: number;
    status: number; // 0=Draft, 1=Approved, 2=Applied, 3=Voided
    reason?: string | null;
    notes?: string | null;
    journalEntryId?: string | null;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
    approvedBy?: string | null;
    voidedAt?: string | null;
    voidedByUserId?: string | null;
    voidReason?: string | null;
    createdAt: string;
    updatedAt: string;
    lines: CreditNoteLine[];
}

export interface DebitNoteLine {
    id?: string;
    debitNoteId?: string;
    lineNumber?: number;
    purchaseBillLineId?: string | null;
    productId?: string | null;
    accountId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    costCenterId?: string | null;
}

export interface DebitNote {
    id: string;
    companyId: string;
    debitNoteNumber: string;
    date: string;
    contactId: string;
    purchaseBillId?: string | null;
    warehouseId?: string | null;
    returnToInventory: boolean;
    currency: string;
    exchangeRate: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    remainingAmount: number;
    status: number; // 0=Draft, 1=Approved, 2=Applied, 3=Voided
    reason?: string | null;
    notes?: string | null;
    journalEntryId?: string | null;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
    approvedBy?: string | null;
    voidedAt?: string | null;
    voidedByUserId?: string | null;
    voidReason?: string | null;
    createdAt: string;
    updatedAt: string;
    lines: DebitNoteLine[];
}

export interface FundTransfer {
    id: string;
    companyId: string;
    transferNumber: string;
    transferDate: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    bankFee: number;
    referenceNumber?: string | null;
    notes?: string | null;
    status: number; // 0=Draft, 1=Posted, 2=Voided
    journalEntryId?: string | null;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
    approvedBy?: string | null;
    voidedAt?: string | null;
    voidedByUserId?: string | null;
    voidReason?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface DeliveryOrderLine {
    id?: string;
    deliveryOrderId?: string;
    lineNumber?: number;
    salesOrderLineId?: string | null;
    productId: string;
    description: string;
    quantityOrdered: number;
    quantityShipped: number;
    unit: string;
    notes?: string | null;
}

export interface DeliveryOrder {
    id: string;
    companyId: string;
    deliveryNumber: string;
    deliveryDate: string;
    salesOrderId?: string | null;
    contactId: string;
    warehouseId?: string | null;
    shippingAddress?: string | null;
    trackingNumber?: string | null;
    driverName?: string | null;
    vehiclePlateNumber?: string | null;
    status: number; // 0=Draft, 1=Shipped, 2=Delivered, 3=Cancelled
    shippedDate?: string | null;
    deliveredDate?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    lines: DeliveryOrderLine[];
}

export interface GoodsReceiptLine {
    id?: string;
    goodsReceiptId?: string;
    lineNumber?: number;
    purchaseOrderLineId?: string | null;
    productId: string;
    description: string;
    quantityOrdered: number;
    quantityReceived: number;
    unit: string;
    notes?: string | null;
}

export interface GoodsReceipt {
    id: string;
    companyId: string;
    receiptNumber: string;
    receiptDate: string;
    purchaseOrderId?: string | null;
    contactId: string;
    warehouseId?: string | null;
    vendorDeliveryNumber?: string | null;
    receivedBy?: string | null;
    status: number; // 0=Draft, 1=Received, 2=Cancelled
    receivedDate?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    lines: GoodsReceiptLine[];
}

export interface SalesOrderLine {
    id?: string;
    salesOrderId?: string;
    lineNumber?: number;
    productId?: string | null;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    isTaxable: boolean;
    taxRate: number;
    taxAmount: number;
    lineTotal: number;
    notes?: string | null;
    costCenterId?: string | null;
}

export interface SalesOrder {
    id: string;
    companyId: string;
    orderNumber: string;
    orderDate: string;
    expectedDeliveryDate?: string | null;
    contactId: string;
    shippingAddress?: string | null;
    currency: string;
    exchangeRate: number;
    subtotal: number;
    discountAmount: number;
    discountPercent: number;
    taxAmount: number;
    total: number;
    status: number; // 0=Draft, 1=Approved, 2=PartiallyDelivered, 3=Delivered, 4=Invoiced, 5=Cancelled
    referenceNumber?: string | null;
    notes?: string | null;
    terms?: string | null;
    templateName: string;
    approvedAt?: string | null;
    approvedByUserId?: string | null;
    approvedBy?: string | null;
    cancelledAt?: string | null;
    createdAt: string;
    updatedAt: string;
    lines: SalesOrderLine[];
}

export interface PeriodClosePreviewAccount {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    classification: string;
    balance: number;
    closingDebit: number;
    closingCredit: number;
}

export interface PeriodClosePreview {
    fiscalYear: number;
    closingDate: string;
    retainedEarningsAccountId: string;
    totalRevenue: number;
    totalExpense: number;
    netIncome: number;
    retainedEarningsAdjustmentDebit: number;
    retainedEarningsAdjustmentCredit: number;
    isBalanced: boolean;
    nominalAccounts: PeriodClosePreviewAccount[];
}

export interface PeriodCloseYearEndRequest {
    fiscalYear: number;
    closingDate?: string;
    retainedEarningsAccountId?: string;
    notes?: string;
    lockPeriod?: boolean;
}

export interface PeriodCloseYearEndResult {
    journalEntryId: string;
    referenceNumber: string;
    closingDate: string;
    fiscalYear: number;
    netIncome: number;
    linesCount: number;
    periodLockedUntil?: string | null;
    message: string;
}

export interface MigrationMilestone {
    step: number;
    title: string;
    key: string;
    status: "completed" | "in_progress" | "pending";
    count: number;
    detail: string;
}

export interface MigrationWizardStatus {
    companyId: string;
    companyName: string;
    lockDate?: string | null;
    overallProgressPercent: number;
    milestones: MigrationMilestone[];
}

export interface MigrationVarianceItem {
    name: string;
    glAccountCode: string;
    glAccountName: string;
    glBalance: number;
    subledgerTotal: number;
    variance: number;
    isBalanced: boolean;
    recommendation: string;
}

export interface MigrationWizardReconciliation {
    companyId: string;
    checkedAt: string;
    openingBalanceEquityBalance: number;
    isEquityCleared: boolean;
    isFullyReconciled: boolean;
    items: MigrationVarianceItem[];
}

