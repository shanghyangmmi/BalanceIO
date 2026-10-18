export interface Product {
    id: string;
    code: string;
    name: string;
    description?: string;
    type: number; // 0=Service, 1=Product
    unit: string;
    sellPrice: number;
    buyPrice: number;
    stockOnHand: number;
    /** Moving-average unit cost; kept at the last average when stock is zero. */
    averageCost: number;
    /** Carrying value of stockOnHand at moving-average cost. */
    inventoryValue: number;
    reorderLevel: number;
    trackInventory: boolean;
    isActive: boolean;
    // Account IDs logic if needed
    incomeAccountId?: string;
    expenseAccountId?: string;
    inventoryAccountId?: string;
}

export interface StockMovement {
    id: string;
    date: Date;
    productId: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT';
    quantity: number;
    reference: string;
}
