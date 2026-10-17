"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Invoice detail used to render a static sample. The real invoice is shown
 * by the preview page, so this route forwards there with the same id.
 */
function Forward() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  useEffect(() => {
    router.replace(id ? `/dashboard/sales/invoices/preview?id=${id}` : "/dashboard/sales/invoices");
  }, [router, id]);
  return null;
}

export default function InvoiceDetailsPage() {
  return (
    <Suspense fallback={null}>
      <Forward />
    </Suspense>
  );
}
