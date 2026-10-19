import { InvoiceForm } from "@/components/sales/invoice-form";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewInvoicePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">Create Invoice</h2>
      </div>

      <div className="mx-auto max-w-5xl">
        <RBACGuard permission={PERMISSIONS.SalesCreate} fallback={<NoPermission permission={PERMISSIONS.SalesCreate} />}>
<InvoiceForm />
</RBACGuard>
      </div>
    </div>
  );
}
