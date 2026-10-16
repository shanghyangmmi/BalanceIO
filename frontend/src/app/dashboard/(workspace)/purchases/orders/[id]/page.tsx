import { OrderDetailView } from "@/components/purchases/order-detail-view"

export async function generateStaticParams() {
    return [{ id: "1" }]
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <OrderDetailView id={id} />
}
