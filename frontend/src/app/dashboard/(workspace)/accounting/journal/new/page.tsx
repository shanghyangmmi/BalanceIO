import { JournalForm } from "@/components/accounting/journal-form";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewJournalPage() {
  return (
    <div className="flex-1 space-y-0 p-0">
      {/* Header Removed */}

      <div className="bg-card text-card-foreground">
        <RBACGuard permission={PERMISSIONS.FinanceCreate} fallback={<NoPermission permission={PERMISSIONS.FinanceCreate} />}>
<JournalForm />
</RBACGuard>
      </div>
    </div>
  );
}
