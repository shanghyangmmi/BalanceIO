"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Types mirror DTOs/PayrollDTOs.cs. */

export interface PayrollCompensation {
  baseSalary: number
  fixedAllowance: number
  jkkRate: number
  bpjsKetenagakerjaan: boolean
  bpjsPension: boolean
  bpjsKesehatan: boolean
  isActive: boolean
  updatedAt: string | null
}

export interface PayrollEmployee {
  contactId: string
  code: string
  name: string
  nik: string | null
  ptkpStatus: string | null
  terCategory: "A" | "B" | "C"
  bpjsKetenagakerjaanNumber: string | null
  bpjsKesehatanNumber: string | null
  bankName: string | null
  bankAccountNumber: string | null
  compensation: PayrollCompensation | null
  issues: string[]
}

export type PayrollRunStatus = "Draft" | "Posted" | "Void"

export interface PayrollRunSummary {
  id: string
  year: number
  month: number
  period: string
  postingDate: string
  status: PayrollRunStatus
  employees: number
  warnings: number
  totalGross: number
  totalPph21: number
  totalEmployeeBpjs: number
  totalEmployerBpjs: number
  totalNetPay: number
  totalCost: number
  journalEntryId: string | null
  journalReference: string | null
  notes: string | null
  createdBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
}

export interface PayrollLine {
  id: string
  contactId: string
  employeeName: string
  nik: string | null
  ptkpStatus: string
  terCategory: string
  baseSalary: number
  fixedAllowance: number
  otherEarnings: number
  employerJkk: number
  employerJkm: number
  employerJht: number
  employerJp: number
  employerKesehatan: number
  employeeJht: number
  employeeJp: number
  employeeKesehatan: number
  taxableGross: number
  terRate: number | null
  pph21Method: "TER" | "Annual"
  pph21: number
  netPay: number
  warning: string | null
}

export interface PayrollJournalLine {
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
}

export interface PayrollRunDetail extends PayrollRunSummary {
  currency: string
  lines: PayrollLine[]
  journal: PayrollJournalLine[]
  blockers: string[]
}

export interface PayrollDeadline {
  label: string
  due: string
  daysRemaining: number
}

export interface PayrollOverview {
  currency: string
  year: number
  month: number
  period: string
  employees: number
  employeesWithoutCompensation: number
  employeesWithIssues: number
  monthlyBaseCost: number
  currentRun: PayrollRunSummary | null
  previousRun: PayrollRunSummary | null
  yearGross: number
  yearPph21: number
  yearEmployerBpjs: number
  yearEmployeeBpjs: number
  yearNetPay: number
  deadlines: PayrollDeadline[]
  runs: PayrollRunSummary[]
}

const KEY = ["payroll"] as const

export function usePayrollOverview() {
  return useQuery({
    queryKey: [...KEY, "overview"],
    queryFn: () => apiClient.get<PayrollOverview>("/Payroll/overview"),
    retry: retryUnlessClientError,
  })
}

export function usePayrollEmployees() {
  return useQuery({
    queryKey: [...KEY, "employees"],
    queryFn: () => apiClient.get<PayrollEmployee[]>("/Payroll/employees"),
    retry: retryUnlessClientError,
  })
}

export function usePayrollRuns() {
  return useQuery({
    queryKey: [...KEY, "runs"],
    queryFn: () => apiClient.get<PayrollRunSummary[]>("/Payroll/runs"),
    retry: retryUnlessClientError,
  })
}

export function usePayrollRun(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "run", id],
    queryFn: () => apiClient.get<PayrollRunDetail>(`/Payroll/runs/${id}`),
    enabled: !!id,
    retry: retryUnlessClientError,
  })
}

/**
 * Every payroll write changes the overview, the run list and the hub card,
 * so each one invalidates the whole payroll key and the hub's health.
 */
function useInvalidate() {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: KEY }),
      client.invalidateQueries({ queryKey: ["dashboard", "module-health"] }),
    ])
}

export function useSaveCompensation() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ contactId, ...body }: Omit<PayrollCompensation, "updatedAt"> & { contactId: string }) =>
      apiClient.put<PayrollCompensation>(`/Payroll/employees/${contactId}/compensation`, body),
    onSuccess: invalidate,
  })
}

export function useCreatePayrollRun() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { year: number; month: number; postingDate?: string; notes?: string }) =>
      apiClient.post<PayrollRunDetail>("/Payroll/runs", body),
    onSuccess: invalidate,
  })
}

export function usePayrollRunAction(id: string) {
  const invalidate = useInvalidate()
  const client = useQueryClient()
  const settle = (run: PayrollRunDetail) => {
    client.setQueryData([...KEY, "run", id], run)
    return invalidate()
  }

  return {
    recalculate: useMutation({
      mutationFn: () => apiClient.post<PayrollRunDetail>(`/Payroll/runs/${id}/recalculate`, {}),
      onSuccess: settle,
    }),
    updateLine: useMutation({
      mutationFn: ({ lineId, otherEarnings }: { lineId: string; otherEarnings: number }) =>
        apiClient.put<PayrollRunDetail>(`/Payroll/runs/${id}/lines/${lineId}`, { otherEarnings }),
      onSuccess: settle,
    }),
    post: useMutation({
      mutationFn: () => apiClient.post<PayrollRunDetail>(`/Payroll/runs/${id}/post`, {}),
      onSuccess: settle,
    }),
    void: useMutation({
      mutationFn: (reason: string) => apiClient.post<PayrollRunDetail>(`/Payroll/runs/${id}/void`, { reason }),
      onSuccess: settle,
    }),
    remove: useMutation({
      mutationFn: () => apiClient.delete<void>(`/Payroll/runs/${id}`),
      onSuccess: () => {
        client.removeQueries({ queryKey: [...KEY, "run", id] })
        return invalidate()
      },
    }),
  }
}
