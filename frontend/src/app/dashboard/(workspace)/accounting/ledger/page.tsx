"use client";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { VirtualDataTable } from "@/components/ui/virtual-data-table";
import {
  ledgerColumns,
  LedgerRow,
} from "@/components/accounting/ledger-columns";
import { apiClient } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Loader2 } from "lucide-react";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function LedgerPage() {
  const [selectedAccount, setSelectedAccount] = useState<string>("ALL");

  // Accounts list — cached; instant on revisit.
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.get<AccountOption[]>("/Accounts"),
    staleTime: 5 * 60_000, // CoA changes rarely
  });

  // Ledger rows for the selected account — cached per account, so
  // flipping between two accounts is instant after the first view.
  const { data: rawEntries, isLoading: loadingLedger } = useQuery({
    queryKey: ["general-ledger", selectedAccount],
    queryFn: () =>
      apiClient.getReportsGeneralLedger(
        undefined,
        undefined,
        selectedAccount === "ALL" ? undefined : selectedAccount,
        undefined
      ),
    enabled: true,
  });

  const data: LedgerRow[] = useMemo(() => {
    if (!rawEntries || !Array.isArray(rawEntries)) return [];
    let runningBalance = 0;
    return rawEntries.map((entry: any, idx: number) => {
      runningBalance += (entry.debit || 0) - (entry.credit || 0);
      return {
        id: entry.journalEntryId || `entry-${idx}`,
        date: entry.date ? new Date(entry.date) : new Date(),
        reference: entry.reference || entry.journalNumber || "-",
        description: entry.description || entry.memo || "-",
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        balance: runningBalance,
      };
    });
  }, [rawEntries]);

  const currentBalance = data.length > 0 ? data[data.length - 1].balance : 0;
  const totalDebit = useMemo(() => data.reduce((s, x) => s + x.debit, 0), [data]);
  const totalCredit = useMemo(() => data.reduce((s, x) => s + x.credit, 0), [data]);

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">
            General Ledger
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and inspect your general ledger balances and transaction history.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {/* Account Selector Card */}
        <Card className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-900/50 border-emerald-500/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="font-semibold text-emerald-600 dark:text-emerald-400">
                  All Accounts
                </SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.code}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {acc.code}
                    </span>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-money">
              <NumberTicker value={currentBalance} format={(v) => formatCurrency(v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-money text-emerald-600 dark:text-emerald-500">
              <NumberTicker value={totalDebit} format={(v) => formatCurrency(v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-money text-zinc-500">
              <NumberTicker value={totalCredit} format={(v) => formatCurrency(v)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Virtualized ledger: only visible rows hit the DOM — 60fps at 10,000+ rows */}
      <div className="rounded-md bg-white dark:bg-zinc-900/50 shadow-sm">
        <VirtualDataTable
          data={data}
          columns={ledgerColumns}
          isLoading={loadingLedger}
          filterColumn="description"
          filterPlaceholder="Search transactions..."
          height="calc(100vh - 460px)"
        />
      </div>
    </div>
  );
}
