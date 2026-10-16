"use client";

import { ProductForm } from "@/components/inventory/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gradient">New Product</h2>
        <p className="text-muted-foreground">Create a new product or service to sell or purchase.</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <ProductForm />
      </div>
    </div>
  );
}
