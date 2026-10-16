"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  FolderTree,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { Account, accountGroupLabels } from "@/lib/types/accounting";
import { cn } from "@/lib/utils";
import { AccountForm } from "@/components/accounting/account-form";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Build tree structure from flat list
function buildTree(accounts: Account[]): Map<string | null, Account[]> {
  const map = new Map<string | null, Account[]>();
  for (const acc of accounts) {
    const parentKey = acc.parentAccountId || null;
    if (!map.has(parentKey)) map.set(parentKey, []);
    map.get(parentKey)!.push(acc);
  }
  return map;
}

interface AccountRowProps {
  account: Account;
  childMap: Map<string | null, Account[]>;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (acc: Account) => void;
  onDelete: (acc: Account) => void;
  onAddChild: (parent: Account) => void;
  searchQuery: string;
}

function AccountRow({
  account,
  childMap,
  expanded,
  toggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  searchQuery,
}: AccountRowProps) {
  const children = childMap.get(account.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(account.id);
  const indent = (account.level - 1) * 24;

  // For search: check if this account or any descendant matches
  const matchesSearch =
    searchQuery === "" ||
    account.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.name.toLowerCase().includes(searchQuery.toLowerCase());

  if (searchQuery && !matchesSearch && !hasDescendantMatch(account.id, childMap, searchQuery)) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 hover:bg-zinc-50 dark:hover:bg-white/5 border-b border-zinc-100 dark:border-white/5 transition-colors",
          account.isHeader && "font-semibold",
          !account.isActive && "opacity-40"
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={() => hasChildren && toggleExpand(account.id)}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-colors",
            hasChildren
              ? "hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
              : "opacity-0"
          )}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>

        {/* Code */}
        <span className="text-xs font-mono text-muted-foreground w-[80px] shrink-0">
          {account.code}
        </span>

        {/* Name */}
        <span className="flex-1 text-sm truncate">
          {account.name}
          {account.description && (
            <span className="ml-2 text-xs text-muted-foreground italic hidden md:inline">
              {account.description}
            </span>
          )}
        </span>

        {/* Level badge */}
        <span className="text-xs text-muted-foreground hidden sm:inline">
          L{account.level}
        </span>

        {/* Balance */}
        <span
          className={cn(
            "text-sm font-mono w-[140px] text-right shrink-0",
            !account.isHeader && "font-medium",
            account.isHeader && "text-muted-foreground"
          )}
        >
          {account.isHeader ? "—" : formatCurrency(account.currentBalance || 0)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          {account.level < 5 && (
            <button
              onClick={() => onAddChild(account)}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
              title="Add sub-account"
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(account)}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!account.isSystemDefault && (
            <button
              onClick={() => onDelete(account)}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        children
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((child) => (
            <AccountRow
              key={child.id}
              account={child}
              childMap={childMap}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              searchQuery={searchQuery}
            />
          ))}
    </>
  );
}

function hasDescendantMatch(
  parentId: string,
  childMap: Map<string | null, Account[]>,
  query: string
): boolean {
  const children = childMap.get(parentId) || [];
  for (const child of children) {
    if (
      child.code.toLowerCase().includes(query.toLowerCase()) ||
      child.name.toLowerCase().includes(query.toLowerCase())
    )
      return true;
    if (hasDescendantMatch(child.id, childMap, query)) return true;
  }
  return false;
}

export default function CoaPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [parentForNew, setParentForNew] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchAccounts = async () => {
    try {
      const data = await apiClient.get<Account[]>("/Accounts");
      setAccounts(data);

      // Auto-expand level 1 and 2 on first load
      const autoExpand = new Set<string>();
      data.forEach((a) => {
        if (a.level <= 2) autoExpand.add(a.id);
      });
      setExpanded(autoExpand);
    } catch (error) {
      console.error("Failed to fetch accounts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => {
    setExpanded(new Set(accounts.map((a) => a.id)));
  };

  const collapseAll = () => {
    const level1 = new Set(accounts.filter((a) => a.level <= 1).map((a) => a.id));
    setExpanded(level1);
  };

  // Group accounts by AccountGroup
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    const groupOrder = [
      "Asset",
      "Liability",
      "Equity",
      "Sales",
      "CostOfSales",
      "Expense",
      "OtherIncomeExpense",
    ];

    groupOrder.forEach((g) => (groups[g] = []));
    accounts.forEach((a) => {
      const group = a.accountGroup || "Asset";
      if (!groups[group]) groups[group] = [];
      groups[group].push(a);
    });

    return groupOrder
      .filter((g) => groups[g].length > 0)
      .map((g) => ({ group: g, accounts: groups[g] }));
  }, [accounts]);

  const handleInitialize = async () => {
    try {
      setInitializing(true);
      await apiClient.post("/Accounts/initialize", {});
      toast.success("Default Chart of Accounts created!");
      await fetchAccounts();
    } catch (error: any) {
      toast.error(error?.message || "Failed to initialize CoA");
    } finally {
      setInitializing(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      if (editingAccount) {
        await apiClient.put(`/Accounts/${editingAccount.id}`, {
          ...data,
          id: editingAccount.id,
        });
        toast.success("Account updated");
      } else {
        await apiClient.post("/Accounts", data);
        toast.success("Account created");
      }
      setSheetOpen(false);
      setEditingAccount(null);
      setParentForNew(null);
      fetchAccounts();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save account");
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setParentForNew(null);
    setSheetOpen(true);
  };

  const handleAddChild = (parent: Account) => {
    setEditingAccount(null);
    setParentForNew(parent);
    setSheetOpen(true);
  };

  const handleDelete = (account: Account) => {
    toast.warning(`Delete "${account.name}"?`, {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await apiClient.delete(`/Accounts/${account.id}`);
            toast.success(`Account "${account.name}" deleted`);
            fetchAccounts();
          } catch (error: any) {
            toast.error(error?.message || "Failed to delete account");
          }
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — show initialize button
  if (accounts.length === 0) {
    return (
      <div className="flex-1 space-y-4">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">
          Chart of Accounts
        </h2>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
              <FolderTree className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Start Your Chart of Accounts</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Get started quickly with a ready-made chart of accounts for your business.
              You can customize, add, or remove accounts anytime.
            </p>
            <Button onClick={handleInitialize} disabled={initializing} size="lg">
              {initializing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">
            Chart of Accounts
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize and manage your chart of accounts ({accounts.filter((a) => !a.isHeader).length} postable accounts, {accounts.length} total nodes across {groupedAccounts.length} groups).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse
          </Button>
          <Sheet
            open={sheetOpen}
            onOpenChange={(val) => {
              if (!val) {
                setEditingAccount(null);
                setParentForNew(null);
              }
              setSheetOpen(val);
            }}
          >
            <Button onClick={() => { setEditingAccount(null); setParentForNew(null); setSheetOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Account
            </Button>
            <SheetContent className="sm:max-w-[540px]">
              <SheetHeader>
                <SheetTitle>
                  {editingAccount
                    ? "Edit Account"
                    : parentForNew
                      ? `New Sub-Account under ${parentForNew.code}`
                      : "Create New Account"}
                </SheetTitle>
                <SheetDescription>
                  {editingAccount
                    ? "Modify account details."
                    : parentForNew
                      ? `This will create a Level ${parentForNew.level + 1} account under "${parentForNew.name}".`
                      : "Add a new account to your chart of accounts."}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-8">
                <AccountForm
                  accounts={accounts}
                  defaultValues={
                    editingAccount
                      ? {
                        code: editingAccount.code,
                        name: editingAccount.name,
                        type: editingAccount.accountGroup as any,
                        parentId: editingAccount.parentAccountId || "none",
                        description: editingAccount.description || "",
                      }
                      : parentForNew
                        ? {
                          code: "",
                          name: "",
                          type: parentForNew.accountGroup as any,
                          parentId: parentForNew.id,
                          description: "",
                        }
                        : undefined
                  }
                  onSubmit={handleCreate}
                  onCancel={() => setSheetOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tree by Group */}
      {groupedAccounts.map(({ group, accounts: groupAccounts }) => {
        const config = accountGroupLabels[group] || {
          label: group,
          labelId: "",
          color: "#6b7280",
          bgColor: "bg-zinc-500/10",
        };
        const childMap = buildTree(groupAccounts);
        const rootAccounts = groupAccounts
          .filter((a) => !a.parentAccountId || !groupAccounts.find((p) => p.id === a.parentAccountId))
          .sort((a, b) => a.code.localeCompare(b.code));

        return (
          <Card key={group} className="overflow-hidden">
            <CardHeader className="py-3 px-4 flex flex-row items-center gap-3">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: config.color }}
              />
              <CardTitle className="text-base flex items-center gap-2">
                {config.label}
                <span className="text-xs font-normal text-muted-foreground italic">
                  ({config.labelId})
                </span>
              </CardTitle>
              <Badge variant="outline" className="ml-auto text-xs">
                {groupAccounts.length} accounts
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {rootAccounts.map((acc) => (
                <AccountRow
                  key={acc.id}
                  account={acc}
                  childMap={childMap}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  searchQuery={searchQuery}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
