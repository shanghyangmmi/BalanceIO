"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { DocumentForm, DocFormType } from "@/components/documents/document-form"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ArrowLeft, Receipt, ShoppingCart, FileText } from "lucide-react"
import Link from "next/link"
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard"
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions"

const documentOptions: {
    type: DocFormType
    title: string
    description: string
    icon: React.ReactNode
    color: string
}[] = [
        {
            type: "sales-invoice",
            title: "Sales Invoice",
            description: "Bill your customers for goods or services",
            icon: <Receipt className="h-6 w-6" />,
            color: "#0B3C3D",
        },
        {
            type: "purchase-order",
            title: "Purchase Order",
            description: "Order goods or services from vendors",
            icon: <ShoppingCart className="h-6 w-6" />,
            color: "#3b82f6",
        },
        {
            type: "purchase-bill",
            title: "Purchase Bill",
            description: "Record bills received from vendors",
            icon: <FileText className="h-6 w-6" />,
            color: "#ef4444",
        },
    ]

const createPermission: Record<DocFormType, Permission> = {
    "sales-invoice": PERMISSIONS.SalesCreate,
    "purchase-order": PERMISSIONS.PurchasesCreate,
    "purchase-bill": PERMISSIONS.PurchasesCreate,
}

export default function NewDocumentPage() {
    const searchParams = useSearchParams()
    const typeParam = searchParams.get("type") as DocFormType | null

    const [selectedType, setSelectedType] = useState<DocFormType | null>(
        typeParam && documentOptions.some((o) => o.type === typeParam)
            ? typeParam
            : null
    )

    // Step 1: Select document type
    if (!selectedType) {
        return (
            <div className="flex-1 space-y-6">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/documents"
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gradient">
                            Create Document
                        </h2>
                        <p className="text-muted-foreground">
                            Select the type of document you want to create.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
                    {documentOptions.map((option) => (
                        <Card
                            key={option.type}
                            className={cn(
                                "cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]",
                                "border-2 border-transparent hover:border-opacity-50"
                            )}
                            style={
                                {
                                    "--hover-border": option.color,
                                } as React.CSSProperties
                            }
                            onClick={() => setSelectedType(option.type)}
                        >
                            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                                <div
                                    className="h-14 w-14 rounded-xl flex items-center justify-center text-white"
                                    style={{ backgroundColor: option.color }}
                                >
                                    {option.icon}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg">{option.title}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {option.description}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    // Step 2: Document form
    const selectedOption = documentOptions.find((o) => o.type === selectedType)!

    return (
        <div className="flex-1 space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => setSelectedType(null)}
                    className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: selectedOption.color }}
                    >
                        {selectedOption.icon}
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gradient">
                            New {selectedOption.title}
                        </h2>
                        <p className="text-muted-foreground">
                            Fill in the details below to create a new{" "}
                            {selectedOption.title.toLowerCase()}.
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl">
                <RBACGuard permission={createPermission[selectedType]} fallback={<NoPermission permission={createPermission[selectedType]} />}>
                    <DocumentForm type={selectedType} />
                </RBACGuard>
            </div>
        </div>
    )
}
