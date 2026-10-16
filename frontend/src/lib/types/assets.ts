export interface AssetCategory {
    id: string;
    name: string;
    usefulLifeYears: number; // Default useful life
    depreciationMethod: 'STRAIGHT_LINE' | 'DOUBLE_DECLINING';
}

export interface FixedAsset {
    id: string;
    name: string;
    category: string;
    purchaseDate: Date;
    cost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    accumulatedDepreciation: number;
    bookValue: number;
    status: 'ACTIVE' | 'DISPOSED' | 'FULLY_DEPRECIATED';
    location?: string;
    serialNumber?: string;
}

export interface DepreciationScheduleItem {
    period: number; // Month number
    date: Date;
    openingBookValue: number;
    depreciationExpense: number;
    accumulatedDepreciation: number;
    closingBookValue: number;
}
